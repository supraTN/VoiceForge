from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List
import numpy as np
import soundfile as sf
import torch
from threading import RLock

from TTS.api import TTS  # Coqui TTS (XTTS v2)

from app.config import VOICE_ROOT
from app.services.dubbing import normalize_peak

@dataclass
class ClonedVoice:
    user_id: str
    voice_id: str
    name: str
    files: List[Path]

class XTTSCloner:
    """
    Service de clonage et synthese via Coqui XTTS v2 en zero-shot.
    - Enrole: on stocke 1..3 WAVs (mono, 22.05/24 kHz, clean speech).
    - Synthese: on passe speaker_wav=[...] au modele.
    """

    def __init__(self, model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS(model_name).to(device)
        self.sample_rate = getattr(self.tts.synthesizer, "output_sample_rate", 24000)
        self._lock = RLock()

    # ---------- utils audio ----------
    @staticmethod
    def _to_wav_mono(tmp_path: Path, dest_path: Path, target_sr: int) -> None:
        """Lit un WAV, convertit en mono + target_sr, sauvegarde WAV."""
        audio, sr = sf.read(str(tmp_path), always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != target_sr:
            try:
                import torchaudio
                wav = torch.from_numpy(audio).float().unsqueeze(0)
                wav = torchaudio.functional.resample(wav, sr, target_sr)
                audio = wav.squeeze(0).numpy()
            except ImportError:
                t_old = np.linspace(0, len(audio)/sr, num=len(audio), endpoint=False)
                t_new = np.linspace(0, len(audio)/target_sr, num=int(len(audio)*target_sr/sr), endpoint=False)
                audio = np.interp(t_new, t_old, audio).astype(np.float32)
        sf.write(str(dest_path), audio.astype(np.float32), target_sr)

    # ---------- enrolement ----------
    def enroll(self, user_id: str, voice_id: str, name: str, wav_paths: List[Path]) -> ClonedVoice:
        base = VOICE_ROOT / user_id / voice_id
        base.mkdir(parents=True, exist_ok=True)
        files_out: List[Path] = []
        for i, p in enumerate(wav_paths):
            out = base / f"clip_{i+1}.wav"
            self._to_wav_mono(p, out, self.sample_rate)
            files_out.append(out)
        (base / "name.txt").write_text(name, encoding="utf-8")
        return ClonedVoice(user_id=user_id, voice_id=voice_id, name=name, files=files_out)

    # ---------- synthese ----------
    def synthesize(self, text: str, lang: str, voice_files: List[Path]) -> np.ndarray:
        with self._lock:
            y = self.tts.tts(
                text=text,
                speaker_wav=[str(p) for p in voice_files],
                language=lang,
                split_sentences=False,
            )
        if isinstance(y, list):
            y = np.concatenate([np.asarray(z, dtype=np.float32).reshape(-1) for z in y]) if y else np.zeros(1, np.float32)
        else:
            y = np.asarray(y, dtype=np.float32).reshape(-1)
        return normalize_peak(y)
