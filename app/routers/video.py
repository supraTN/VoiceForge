# app/routers/video.py
from __future__ import annotations

import json
import logging
import math
import os
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

import numpy as np
import soundfile as sf
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import MAX_UPLOAD_MB, TMP_UPLOAD_DIR, VOICE_ROOT
from app.deps import (
    DEFAULT_SAMPLE_RATE,
    mt_available,
    require_token,
    transcribe_video,
    translate_segments,
    user_id_from_header,
    video_asr_available,
    xtts,
)
from app.services import dubbing

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Video"])

VIDEO_DATA_DIR = os.environ.get("VIDEO_DATA_DIR", "data/videos")


# ---------- Schemas ----------

class VideoSegIn(BaseModel):
    start: float
    end: float
    text: str


class VideoTranslateReq(BaseModel):
    target_lang: str
    source_language: Optional[str] = None
    segments: List[VideoSegIn]


# ---------- Routes ----------

@router.post("/video/transcribe", dependencies=[Depends(require_token)])
async def video_transcribe(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
):
    """Transcribe a video file and return timed segments with detected language."""
    if not video_asr_available:
        raise HTTPException(status_code=503, detail="Video ASR not available on this service.")

    ext = Path(file.filename).suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".mkv", ".webm", ".avi"}:
        ext = ".mp4"

    tmp_video = TMP_UPLOAD_DIR / f"{uuid4().hex}{ext}"
    total = 0
    try:
        with open(tmp_video, "wb") as w:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail=f"File > {MAX_UPLOAD_MB} MB")
                w.write(chunk)
    except HTTPException:
        tmp_video.unlink(missing_ok=True)
        raise

    try:
        result = transcribe_video(str(tmp_video), sample_rate=DEFAULT_SAMPLE_RATE)
    except Exception as e:
        logger.exception("Transcription error")
        raise HTTPException(status_code=500, detail=f"Transcription error: {type(e).__name__}: {e}")
    finally:
        tmp_video.unlink(missing_ok=True)

    return JSONResponse(result)


@router.post("/video/translate", dependencies=[Depends(require_token)])
async def video_translate(req: VideoTranslateReq):
    """Translate a list of timed segments to the target language."""
    if not mt_available:
        raise HTTPException(status_code=503, detail="Translation not available on this service.")
    try:
        result = translate_segments(
            segments=[s.dict() for s in req.segments],
            target_lang=req.target_lang,
            source_lang=req.source_language,
        )
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation error: {e}")


@router.post("/video/dub", dependencies=[Depends(require_token)])
async def video_dub(
    file: UploadFile = File(...),
    target_lang: str = Form(...),
    mode: str = Form("replace"),               # "replace" or "mix_simple"
    use_voice_id: Optional[str] = Form(None),  # existing enrolled voice
    segments_json: Optional[str] = Form(None), # pre-translated segments (optional)
    x_user_id: Optional[str] = Header(None),
):
    """
    One-click video dubbing pipeline:
    upload -> ASR -> translation -> voice synthesis -> remux -> return MP4.
    """
    if xtts is None:
        raise HTTPException(status_code=503, detail="XTTS not available on this service.")
    user_id = user_id_from_header(x_user_id)

    # 1) Save uploaded video
    ext = Path(file.filename).suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".mkv", ".webm", ".avi"}:
        ext = ".mp4"
    job_id = uuid4().hex
    workdir = Path(VIDEO_DATA_DIR) / user_id / job_id
    workdir.mkdir(parents=True, exist_ok=True)
    video_path = workdir / f"input{ext}"

    total = 0
    try:
        with open(video_path, "wb") as w:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail=f"File > {MAX_UPLOAD_MB} MB")
                w.write(chunk)
    except HTTPException:
        video_path.unlink(missing_ok=True)
        raise

    # 2) Extract source audio
    src_wav = str(workdir / "source.wav")
    total_dur = dubbing.extract_audio(str(video_path), src_wav, sr=DEFAULT_SAMPLE_RATE)

    # 3) Resolve segments (provided JSON, or ASR + MT)
    detected_lang: Optional[str] = None
    try:
        segments, detected_lang = _prepare_segments(str(video_path), segments_json, target_lang)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segment preparation error: {e}")

    if not segments:
        raise HTTPException(status_code=400, detail="No segments to synthesise.")

    # 4) Resolve voice reference clips
    try:
        if use_voice_id:
            base = VOICE_ROOT / user_id / use_voice_id
            if not base.exists():
                raise HTTPException(status_code=404, detail="voice_id not found")
            ref_files = sorted([str(p) for p in base.glob("clip_*.wav")])
            if not ref_files:
                raise HTTPException(status_code=400, detail="No WAV clips for this voice")
        else:
            ref_files = dubbing.pick_reference_clips(src_wav, segments, n=3, clip_len=4.0)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice preparation error: {e}")

    # 5) Synthesise segments and assemble voice track
    try:
        sr = int(getattr(xtts, "sample_rate", DEFAULT_SAMPLE_RATE))
        mix = _build_voice_track(segments, target_lang, ref_files, total_dur, sr)
        voice_wav = str(workdir / "voice_track.wav")
        sf.write(voice_wav, mix, sr, format="WAV", subtype="PCM_16")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis error: {e}")

    # 6) Optional mix + remux
    try:
        final_audio = voice_wav
        if mode == "mix_simple":
            mixed_wav = str(workdir / "mixed.wav")
            dubbing.simple_mix(src_wav, voice_wav, mixed_wav)
            final_audio = mixed_wav
        out_mp4 = str(workdir / "dubbed.mp4")
        dubbing.replace_audio(str(video_path), final_audio, out_mp4)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Remux error: {e}")

    # 7) Export SRT + JSON transcript
    try:
        srt_path = str(workdir / "subtitles.srt")
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(dubbing.make_srt(segments))
        transcript_path = str(workdir / "transcript.json")
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(
                {"source_language": detected_lang, "target_language": target_lang, "segments": segments},
                f, ensure_ascii=False, indent=2,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SRT/JSON export error: {e}")

    def _rel(p: str) -> str:
        return "/" + p.replace("\\", "/")

    return JSONResponse({
        "job_id": job_id,
        "detected_language": detected_lang,
        "outputs": {
            "video":      _rel(out_mp4),
            "voice_wav":  _rel(voice_wav),
            "srt":        _rel(srt_path),
            "transcript": _rel(transcript_path),
        },
    })


# ---------- Orchestration helpers (private to this module) ----------

def _prepare_segments(
    video_path: str,
    segments_json: Optional[str],
    target_lang: str,
) -> tuple[list[dict], Optional[str]]:
    """Resolve segments: from provided JSON, or by running ASR + MT on the video."""
    if segments_json:
        payload = json.loads(segments_json)
        segs_in = payload.get("segments", payload)
        return [
            {
                "start":    float(s.get("start", 0.0)),
                "end":      float(s.get("end",   0.0)),
                "text_tgt": str(s.get("text_tgt") or s.get("text") or ""),
            }
            for s in segs_in
        ], None

    if not video_asr_available:
        raise HTTPException(status_code=503, detail="Video ASR not available on this service.")
    if not mt_available:
        raise HTTPException(status_code=503, detail="Translation not available on this service.")

    asr_res = transcribe_video(str(video_path), sample_rate=DEFAULT_SAMPLE_RATE)
    tr_res  = translate_segments(
        segments=asr_res["segments"],
        target_lang=target_lang,
        source_lang=asr_res.get("language"),
    )
    segments = [
        {"start": s["start"], "end": s["end"], "text_tgt": s["text_tgt"]}
        for s in tr_res["segments"]
    ]
    return segments, asr_res.get("language")


def _build_voice_track(
    segments: list[dict],
    target_lang: str,
    ref_files: list[str],
    total_dur: float,
    sr: int,
) -> np.ndarray:
    """Synthesise each segment and assemble a single normalised voice track."""
    total_len = int(math.ceil(total_dur * sr)) + sr
    mix = np.zeros(total_len, dtype=np.float32)
    cursor_sec = 0.0

    for seg in segments:
        txt = str(seg.get("text_tgt") or "").strip()
        if not txt:
            continue

        win_start = max(float(seg["start"]), cursor_sec + dubbing.MIN_GAP_SEC)
        win_end   = max(win_start + 0.02, float(seg["end"]))
        window    = max(0.02, win_end - win_start)

        y = xtts.synthesize(text=txt, lang=target_lang, voice_files=[Path(p) for p in ref_files])

        len_sec = y.shape[0] / sr
        if len_sec > window * (1 + dubbing.FIT_TOL):
            y = dubbing.time_stretch(y, sr, min(dubbing.MAX_SPEEDUP, len_sec / max(window, 0.01)))
        elif len_sec < window * (1 - dubbing.FIT_TOL):
            target_len = int(window * sr)
            if target_len > y.shape[0]:
                y = np.pad(y, (0, target_len - y.shape[0]))

        fade = int(0.01 * sr)
        if fade > 0 and y.size > 2 * fade:
            y[:fade]  *= np.linspace(0, 1, fade, dtype=np.float32)
            y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)

        start_idx = max(0, int(win_start * sr))
        end_idx   = start_idx + y.shape[0]
        if end_idx > mix.shape[0]:
            mix = np.pad(mix, (0, end_idx - mix.shape[0]))
        mix[start_idx:end_idx] += y
        cursor_sec = end_idx / sr

    return dubbing.normalize_peak(mix)
