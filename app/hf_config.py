# app/hf_config.py
"""Shared HuggingFace cache configuration."""
from __future__ import annotations

import os
from pathlib import Path

HF_CACHE = os.getenv("HF_HOME") or os.getenv("HUGGINGFACE_HUB_CACHE") or str(Path("data/hf-cache").resolve())
os.makedirs(HF_CACHE, exist_ok=True)
os.environ.setdefault("HF_HOME", HF_CACHE)
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", HF_CACHE)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
