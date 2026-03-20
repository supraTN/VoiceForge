# app/routers/tts.py
from __future__ import annotations

import io
from typing import List, Optional

import soundfile as sf
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import ALLOWED_VOICES, MAX_TEXT_CHARS
from app.deps import DEFAULT_SAMPLE_RATE, kokoro, require_token

router = APIRouter(tags=["TTS"])


class VoicesResponse(BaseModel):
    lang_code: str
    voices: List[str]


class TTSReq(BaseModel):
    text: str
    lang_code: str = "f"
    voice: Optional[str] = None
    speed: float = 1.0


@router.get("/voices", response_model=VoicesResponse)
def get_voices(lang: str = Query("f", min_length=1, max_length=1)):
    """Return the list of allowed voices for a given language code."""
    voices = ALLOWED_VOICES.get(lang)
    if not voices:
        raise HTTPException(status_code=404, detail="Unknown language")
    return {"lang_code": lang, "voices": voices}


@router.post("/tts", dependencies=[Depends(require_token)])
def tts_generic(req: TTSReq):
    """Synthesise speech via Kokoro and return a WAV stream."""
    if kokoro is None:
        raise HTTPException(status_code=503, detail="Kokoro not available on this service.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text.")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Text too long (max {MAX_TEXT_CHARS} chars).")

    allowed = ALLOWED_VOICES.get(req.lang_code, [])
    voice = req.voice or (allowed[0] if allowed else None)
    if voice and allowed and voice not in allowed:
        raise HTTPException(status_code=400, detail="Voice not allowed for this language.")

    try:
        audio = kokoro.synthesize(text=text, lang_code=req.lang_code, voice=voice, speed=req.speed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kokoro error: {e}")

    buf = io.BytesIO()
    sf.write(buf, audio, DEFAULT_SAMPLE_RATE, format="WAV")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav",
                             headers={"Content-Disposition": 'inline; filename="tts.wav"'})
