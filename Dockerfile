# Dockerfile (CPU)
# 1) Base image
FROM python:3.11-slim

# 2) System dependencies: audio, g2p, video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libsndfile1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# 3) Working directory
WORKDIR /app

# 4) Install Python deps first to leverage Docker layer cache
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5) Copy application code (after deps to keep cache efficient)
COPY app /app/app

# 6) Expose port (informational)
EXPOSE 8000

# 7) Start FastAPI via uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
