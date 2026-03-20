# app/video_asr.py
from __future__ import annotations

import os
from uuid import uuid4
from typing import Optional, Dict, List

from faster_whisper import WhisperModel

from app.hf_config import HF_CACHE
from app.services.dubbing import extract_audio, ffrun  # noqa: F401 — reuse shared ffmpeg helpers

ASR_MODEL_NAME = os.getenv("ASR_MODEL", "large-v3")
ASR_DEVICE = "cuda" if os.getenv("USE_CPU_ASR", "0") != "1" else "cpu"
ASR_COMPUTE = "float16" if ASR_DEVICE == "cuda" else "int8"

asr_model = WhisperModel(
    ASR_MODEL_NAME,
    device=ASR_DEVICE,
    compute_type=ASR_COMPUTE,
    download_root=HF_CACHE,
)

def transcribe_video(video_path: str, sample_rate: int = 24000, language: Optional[str] = None) -> Dict:
    """Extrait l'audio et renvoie {language, segments[{start,end,text}]}."""
    tmp_wav = os.path.join(os.path.dirname(video_path), f"{uuid4().hex}.wav")
    try:
        extract_audio(video_path, tmp_wav, sr=sample_rate)
        lang = language.lower() if isinstance(language, str) else None
        segments, info = asr_model.transcribe(
            tmp_wav,
            language=lang,
            task="transcribe",
            temperature=0.0,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        out: List[Dict[str, float | str]] = []
        for s in segments:
            out.append({"start": float(s.start), "end": float(s.end), "text": s.text.strip()})
        return {"language": getattr(info, "language", None), "segments": out}
    finally:
        try:
            os.remove(tmp_wav)
        except OSError:
            pass
