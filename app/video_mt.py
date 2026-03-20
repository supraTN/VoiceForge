# app/video_mt.py
from __future__ import annotations

import os
from typing import List, Dict, Optional

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from app.hf_config import HF_CACHE

MT_MODEL_NAME = os.getenv("MT_MODEL", "facebook/m2m100_418M")

# Device MT (GPU si dispo et pas force CPU)
USE_CPU_MT = os.getenv("USE_CPU_MT", "0") == "1"
_device = "cuda" if (torch.cuda.is_available() and not USE_CPU_MT) else "cpu"

# Load tokenizer and model once at startup
mt_tokenizer = AutoTokenizer.from_pretrained(MT_MODEL_NAME, cache_dir=HF_CACHE)
mt_model = AutoModelForSeq2SeqLM.from_pretrained(
    MT_MODEL_NAME, cache_dir=HF_CACHE, tie_word_embeddings=False
).to(_device)
mt_model.eval()

BATCH_SIZE = 16


def _translate_batch(texts: List[str], src_lang: Optional[str], tgt_lang: str, max_new_tokens: int = 256) -> List[str]:
    forced_bos = mt_tokenizer.get_lang_id(tgt_lang)
    if src_lang:
        try:
            mt_tokenizer.src_lang = src_lang
        except Exception:
            pass

    enc = mt_tokenizer(texts, return_tensors="pt", padding=True, truncation=True)
    enc = {k: v.to(_device) for k, v in enc.items()}
    with torch.no_grad():
        gen = mt_model.generate(
            **enc,
            forced_bos_token_id=forced_bos,
            max_new_tokens=max_new_tokens,
            num_beams=4,
            length_penalty=1.0,
        )
    out = mt_tokenizer.batch_decode(gen, skip_special_tokens=True)
    return [s.strip() for s in out]


def translate_segments(
    segments: List[Dict],
    target_lang: str,
    source_lang: Optional[str] = None,
) -> Dict:
    """
    Prend des segments [{start,end,text}] et renvoie:
    { target_language, source_language, segments: [{start,end,text_src,text_tgt}] }
    """
    tgt = (target_lang or "fr").lower()
    src = source_lang.lower() if isinstance(source_lang, str) else None

    texts = [str(s.get("text", "") or "") for s in segments]
    if not texts:
        return {"target_language": tgt, "source_language": src, "segments": []}

    translated: List[str] = []
    for i in range(0, len(texts), BATCH_SIZE):
        translated.extend(_translate_batch(texts[i:i + BATCH_SIZE], src, tgt))

    merged = []
    for s, t_src, t_tgt in zip(segments, texts, translated):
        merged.append({
            "start": float(s.get("start", 0.0)),
            "end": float(s.get("end", 0.0)),
            "text_src": t_src,
            "text_tgt": t_tgt,
        })

    return {
        "target_language": tgt,
        "source_language": src,
        "segments": merged,
    }
