# app/tts_service.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from threading import RLock

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from app.config import ALLOWED_VOICES

DEFAULT_SAMPLE_RATE = 24_000
DEFAULT_MAX_CHARS   = 2_000

@dataclass
class KokoroTTS:
    """
    Wrapper autour de Kokoro KPipeline (v0.19).
    - Concatene les segments en un seul signal mono 24 kHz.
    - Valide la voix et la longueur de texte.
    - Recharge le pipeline si la langue demandee change.
    """
    lang_code: str = "f"
    allowed_voices: Dict[str, List[str]] = field(default_factory=lambda: dict(ALLOWED_VOICES))
    max_chars: int = DEFAULT_MAX_CHARS
    sample_rate: int = DEFAULT_SAMPLE_RATE

    _pipeline: Optional[KPipeline] = field(init=False, repr=False, default=None)
    _lock: RLock = field(init=False, repr=False, default_factory=RLock)

    def __post_init__(self) -> None:
        self._pipeline = KPipeline(lang_code=self.lang_code)

    # --------- helpers internes ---------
    def _ensure_pipeline_for_lang(self, lang: str) -> None:
        lang = (lang or self.lang_code).lower()
        with self._lock:
            if self._pipeline is None or lang != self.lang_code:
                self._pipeline = KPipeline(lang_code=lang)
                self.lang_code = lang

    def _pick_voice(self, lang: str, voice: Optional[str]) -> str:
        voices = self.allowed_voices.get(lang, [])
        if not voices:
            raise ValueError(f"Aucune voix configuree pour '{lang}'.")
        chosen = voice or voices[0]
        if chosen not in voices:
            raise ValueError(f"Voix '{chosen}' non autorisee pour '{lang}'. Voix valides: {voices}")
        return chosen

    # --------- API publique ---------
    def synthesize(
        self,
        text: str,
        lang_code: Optional[str] = None,
        voice: Optional[str] = None,
        speed: float = 1.0,
    ) -> np.ndarray:
        """Retourne le signal audio mono (float32) 24 kHz."""
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Texte vide.")
        if len(text) > self.max_chars:
            raise ValueError(f"Texte trop long (max {self.max_chars} caracteres).")

        lang = (lang_code or self.lang_code).lower()
        self._ensure_pipeline_for_lang(lang)
        v = self._pick_voice(lang, voice)

        spd = max(0.5, min(1.5, float(speed)))

        with self._lock:
            segments = self._pipeline(text.strip(), voice=v, speed=spd)
        chunks: List[np.ndarray] = []
        for _g, _p, wav in segments:
            arr = np.asarray(wav, dtype=np.float32).reshape(-1)
            if arr.size:
                chunks.append(arr)

        if not chunks:
            raise RuntimeError("Aucun audio genere par Kokoro.")

        return np.concatenate(chunks, axis=0)

    def synthesize_to_wav_bytes(
        self,
        text: str,
        *,
        lang_code: Optional[str] = None,
        voice: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        """Version pratique qui retourne directement un WAV (bytes)."""
        audio = self.synthesize(text=text, lang_code=lang_code, voice=voice, speed=speed)
        import io
        buf = io.BytesIO()
        sf.write(buf, audio, self.sample_rate, format="WAV")
        buf.seek(0)
        return buf.read()
