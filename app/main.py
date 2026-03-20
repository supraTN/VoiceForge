# app/main.py
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import ALLOWED_ORIGINS, APP_TITLE
from app.routers import clone, tts, video

# ---------- App ----------
app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-Id"],
)

# ---------- Routes ----------
app.include_router(tts.router)
app.include_router(clone.router)
app.include_router(video.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": APP_TITLE}


# ---------- Static files (served output: videos, subtitles, etc.) ----------
os.makedirs("data/videos", exist_ok=True)
try:
    app.mount("/data", StaticFiles(directory="data"), name="data")
except Exception:
    pass


# ---------- Uniform JSON error responses ----------
@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
