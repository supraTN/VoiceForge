# app/routers/clone.py
from __future__ import annotations

import io
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

import soundfile as sf
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import MAX_TEXT_CHARS, MAX_UPLOAD_MB, TMP_UPLOAD_DIR, VOICE_ROOT
from app.deps import require_token, user_id_from_header, xtts

router = APIRouter(tags=["Voice Cloning"])


# ---------- Schemas ----------

class CloneEnrollResp(BaseModel):
    voice_id: str
    name: str


class CloneListItem(BaseModel):
    voice_id: str
    name: str
    clips: int


class TTSClonedReq(BaseModel):
    text: str
    lang_code: str = "f"
    voice_id: str


# ---------- Helpers ----------

def _list_user_voices(user_id: str) -> List[CloneListItem]:
    base = VOICE_ROOT / user_id
    if not base.exists():
        return []
    out: List[CloneListItem] = []
    for d in base.iterdir():
        if d.is_dir():
            name = (d / "name.txt").read_text(encoding="utf-8") if (d / "name.txt").exists() else d.name
            clips = len(list(d.glob("clip_*.wav")))
            out.append(CloneListItem(voice_id=d.name, name=name, clips=clips))
    return out


def _voice_files(user_id: str, voice_id: str) -> List[Path]:
    base = VOICE_ROOT / user_id / voice_id
    if not base.exists():
        raise HTTPException(status_code=404, detail="voice_id not found")
    files = sorted(base.glob("clip_*.wav"))
    if not files:
        raise HTTPException(status_code=400, detail="No clips for this voice")
    return files


# ---------- Routes ----------

@router.post("/clone/enroll", response_model=CloneEnrollResp, dependencies=[Depends(require_token)])
async def clone_enroll(
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    x_user_id: Optional[str] = Header(None),
):
    """Register 1-3 WAV clips and create a new cloned voice profile."""
    if xtts is None:
        raise HTTPException(status_code=503, detail="XTTS not available on this service.")

    user_id = user_id_from_header(x_user_id)

    if not (1 <= len(files) <= 3):
        raise HTTPException(status_code=400, detail="Upload 1 to 3 WAV files")

    total = 0
    tmp_paths: List[Path] = []
    try:
        for f in files:
            if not f.filename.lower().endswith(".wav"):
                raise HTTPException(status_code=400, detail="Only .wav files are accepted")
            data = await f.read()
            total += len(data)
            if total > MAX_UPLOAD_MB * 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"Total > {MAX_UPLOAD_MB} MB")

            p = TMP_UPLOAD_DIR / f"{uuid4().hex}.wav"
            p.write_bytes(data)

            try:
                sf.read(str(p), always_2d=False)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Unreadable audio file: {f.filename}")

            tmp_paths.append(p)

        voice_id = uuid4().hex
        xtts.enroll(user_id=user_id, voice_id=voice_id, name=name, wav_paths=tmp_paths)
        return CloneEnrollResp(voice_id=voice_id, name=name)

    finally:
        for p in tmp_paths:
            p.unlink(missing_ok=True)


@router.get("/clone/voices", response_model=List[CloneListItem], dependencies=[Depends(require_token)])
async def clone_voices(x_user_id: Optional[str] = Header(None)):
    """List all registered voice profiles for the current user."""
    return _list_user_voices(user_id_from_header(x_user_id))


@router.post("/tts/cloned", dependencies=[Depends(require_token)])
async def tts_cloned(req: TTSClonedReq, x_user_id: Optional[str] = Header(None)):
    """Synthesise speech using a registered cloned voice."""
    if xtts is None:
        raise HTTPException(status_code=503, detail="XTTS not available on this service.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text.")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Text too long (max {MAX_TEXT_CHARS} chars).")

    user_id = user_id_from_header(x_user_id)
    files = _voice_files(user_id, req.voice_id)

    lang_map = {"f": "fr", "a": "en", "b": "en"}
    lang = lang_map.get(req.lang_code, req.lang_code)

    try:
        audio = xtts.synthesize(text=text, lang=lang, voice_files=files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"XTTS error: {e}")

    buf = io.BytesIO()
    sr = getattr(xtts, "sample_rate", 24000)
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav",
                             headers={"Content-Disposition": 'inline; filename="tts_cloned.wav"'})
