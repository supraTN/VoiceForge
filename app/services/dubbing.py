# app/services/dubbing.py
"""
Pure ffmpeg utility functions for video dubbing.
No AI model dependencies — only subprocesses and audio I/O.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
from typing import Optional

import numpy as np
import soundfile as sf

from app.config import NORM_PEAK

# Timing parameters (tunable via environment variables)
MIN_GAP_SEC  = float(os.getenv("DUB_MIN_GAP_SEC",  "0.06"))  # 60 ms between dubbed lines
FIT_TOL      = float(os.getenv("DUB_FIT_TOL",       "0.10"))  # ±10 % tolerance before retiming
MAX_SPEEDUP  = float(os.getenv("DUB_MAX_SPEEDUP",   "1.4"))   # maximum speed-up factor
MAX_SLOWDOWN = float(os.getenv("DUB_MAX_SLOWDOWN",  "0.8"))   # minimum speed factor (slowest)
REF_CLIP_MIN_RATIO = 0.7   # minimum segment/clip_len ratio to pick a reference clip
BG_GAIN_DB = -12.0         # background gain for simple mix mode


# ---------- subprocess helpers ----------

def ffrun(cmd: list[str]) -> None:
    """Run an ffmpeg/ffprobe command; raise RuntimeError on non-zero exit."""
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode("utf-8", errors="ignore"))


def ffprobe_duration(path: str) -> float:
    """Return the duration (seconds) of a media file via ffprobe."""
    cmd = [
        os.getenv("FFPROBE_BIN", "ffprobe"), "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", path,
    ]
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().strip()
        return float(out)
    except Exception:
        return 0.0


# ---------- audio helpers ----------

def extract_audio(video_in: str, wav_out: str, sr: int = 24000) -> float:
    """Extract mono audio from a video file; return duration in seconds."""
    ffmpeg = os.getenv("FFMPEG_BIN", "ffmpeg")
    ffrun([ffmpeg, "-y", "-i", video_in, "-vn", "-ac", "1", "-ar", str(sr), "-c:a", "pcm_s16le", wav_out])
    return ffprobe_duration(wav_out)


def atempo_chain(factor: float) -> str:
    """
    Build an ffmpeg atempo filter chain.
    ffmpeg's atempo is clamped to [0.5, 2.0], so we chain filters for extreme values.
    """
    if factor <= 0:
        factor = 1.0
    chain: list[str] = []
    f = factor
    while f > 2.0:
        chain.append("atempo=2.0")
        f /= 2.0
    while f < 0.5:
        chain.append("atempo=0.5")
        f /= 0.5
    chain.append(f"atempo={f:.4f}")
    return ",".join(chain)


def time_stretch(y: np.ndarray, sr: int, factor: float) -> np.ndarray:
    """Time-stretch an audio array by `factor` using ffmpeg's atempo filter."""
    in_w: Optional[str] = None
    out_w: Optional[str] = None
    d: Optional[str] = None
    try:
        d = tempfile.mkdtemp(prefix="stretch_")
        in_w = os.path.join(d, "in.wav")
        out_w = os.path.join(d, "out.wav")
        sf.write(in_w, y.astype(np.float32), sr, format="WAV", subtype="PCM_16")
        ffmpeg = os.getenv("FFMPEG_BIN", "ffmpeg")
        ffrun([ffmpeg, "-y", "-i", in_w, "-filter:a", atempo_chain(factor), "-c:a", "pcm_s16le", out_w])
        y2, _ = sf.read(out_w, dtype="float32", always_2d=False)
        return y2.astype(np.float32)
    finally:
        for p in [in_w, out_w, d]:
            try:
                if p and os.path.isdir(p):
                    os.rmdir(p)
                elif p and os.path.isfile(p):
                    os.remove(p)
            except Exception:
                pass


def pick_reference_clips(
    src_wav: str,
    segments: list[dict],
    n: int = 3,
    clip_len: float = 4.0,
) -> list[str]:
    """Extract up to `n` reference clips from the source audio for zero-shot voice cloning."""
    ffmpeg = os.getenv("FFMPEG_BIN", "ffmpeg")
    refs: list[str] = []
    tmpdir = tempfile.mkdtemp(prefix="refclips_")
    for seg in segments:
        dur = float(seg.get("end", 0.0)) - float(seg.get("start", 0.0))
        if dur >= clip_len * REF_CLIP_MIN_RATIO:
            out = os.path.join(tmpdir, f"ref_{len(refs) + 1}.wav")
            ffrun([
                ffmpeg, "-y",
                "-ss", f"{seg['start']:.2f}", "-t", f"{min(dur, clip_len):.2f}",
                "-i", src_wav, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", out,
            ])
            refs.append(out)
        if len(refs) >= n:
            break
    if not refs:
        out = os.path.join(tmpdir, "ref_fallback.wav")
        ffrun([ffmpeg, "-y", "-t", f"{clip_len:.2f}", "-i", src_wav,
               "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", out])
        refs.append(out)
    return refs


def make_srt(segments: list[dict]) -> str:
    """Generate SRT subtitle content from a list of timed segments."""
    def fmt(t: float) -> str:
        h, m, s = int(t // 3600), int((t % 3600) // 60), int(t % 60)
        ms = int(round((t - int(t)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(f"{fmt(float(seg['start']))} --> {fmt(float(seg['end']))}")
        lines.append(str(seg.get("text_tgt") or seg.get("text") or ""))
        lines.append("")
    return "\n".join(lines)


def simple_mix(original_wav: str, voice_wav: str, out_wav: str, bg_gain_db: float = BG_GAIN_DB) -> None:
    """Mix dubbed voice over the original audio track (background at reduced gain)."""
    ffmpeg = os.getenv("FFMPEG_BIN", "ffmpeg")
    vol = 10 ** (bg_gain_db / 20.0)
    ffrun([
        ffmpeg, "-y",
        "-i", original_wav, "-i", voice_wav,
        "-filter_complex", f"[0:a]volume={vol:.6f}[bg];[bg][1:a]amix=inputs=2:normalize=0",
        "-c:a", "pcm_s16le", out_wav,
    ])


def replace_audio(video_in: str, audio_in: str, video_out: str) -> None:
    """Replace the audio track of a video file (video stream is copied losslessly)."""
    ffmpeg = os.getenv("FFMPEG_BIN", "ffmpeg")
    ffrun([
        ffmpeg, "-y", "-i", video_in, "-i", audio_in,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", video_out,
    ])


def normalize_peak(y: np.ndarray, target: float = NORM_PEAK) -> np.ndarray:
    """Normalize audio to a target peak level."""
    peak = float(np.max(np.abs(y)) or 1.0)
    return (y / peak * target).astype(np.float32)
