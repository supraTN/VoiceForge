# app/config.py
from __future__ import annotations

import os
from pathlib import Path

APP_TITLE      = "Kokoro + XTTS API"
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "2000"))
MAX_UPLOAD_MB  = int(os.getenv("MAX_UPLOAD_MB",  "25"))
TMP_UPLOAD_DIR = Path(os.getenv("TMP_UPLOAD_DIR", "tmp_uploads"))
TMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Optional bearer token — if set, all protected routes require Authorization: Bearer <token>
TTS_BEARER = os.getenv("TTS_BEARER")

# Voice data directory
VOICE_ROOT = Path(os.getenv("VOICE_ROOT", "data/voices"))
VOICE_ROOT.mkdir(parents=True, exist_ok=True)

# Audio normalisation target peak level
NORM_PEAK = 0.95

# Allowed voices per language code
ALLOWED_VOICES = {
    "f": ["ff_siwis"],                                          # Français
    "a": ["af_heart", "af_bella", "af_nicole", "am_michael"],  # EN-US
    "b": ["bf_emma", "bm_george"],                             # EN-UK
}
