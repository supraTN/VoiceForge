# app/deps.py
"""
Shared FastAPI dependencies and service singletons.
All AI models are initialised once at startup with graceful fallbacks.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import Header, HTTPException

from app.config import TTS_BEARER, VOICE_ROOT

logger = logging.getLogger(__name__)


# ---------- Auth dependency ----------

def require_token(authorization: Optional[str] = Header(None)) -> None:
    """Require a valid Bearer token when TTS_BEARER is set in env."""
    if not TTS_BEARER:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    if authorization.split(" ", 1)[1] != TTS_BEARER:
        raise HTTPException(status_code=403, detail="Invalid token")


def user_id_from_header(x_user_id: Optional[str]) -> str:
    """Extract and validate the caller's user id.
    """
    uid = x_user_id or "demo-user"
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,64}", uid):
        raise HTTPException(status_code=400, detail="Invalid X-User-Id")
    return uid


# ---------- Kokoro TTS ----------

DEFAULT_SAMPLE_RATE: int = 24000
kokoro: Optional["KokoroTTS"] = None  # type: ignore[name-defined]
try:
    from app.tts_service import KokoroTTS, DEFAULT_SAMPLE_RATE as _SR

    kokoro = KokoroTTS(lang_code="f")
    DEFAULT_SAMPLE_RATE = _SR
    logger.info("Kokoro loaded.")
except Exception as e:
    logger.warning("Kokoro not initialised: %s", e)


# ---------- XTTS (Coqui voice cloning) ----------

xtts: Optional["XTTSCloner"] = None  # type: ignore[name-defined]
try:
    from app.clone_service import XTTSCloner

    xtts = XTTSCloner()
    logger.info("XTTS (Coqui) loaded.")
except Exception as e:
    logger.warning("XTTS not initialised: %s", e)


# ---------- Video ASR (faster-whisper) ----------

video_asr_available: bool = False
transcribe_video = None
try:
    from app.video_asr import transcribe_video

    video_asr_available = True
    logger.info("Video ASR (faster-whisper) loaded.")
except Exception as e:
    logger.warning("Video ASR not initialised: %s", e)


# ---------- Machine Translation (M2M100) ----------

mt_available: bool = False
translate_segments = None
try:
    from app.video_mt import translate_segments

    mt_available = True
    logger.info("MT (M2M100) loaded.")
except Exception as e:
    logger.warning("MT not initialised: %s", e)
