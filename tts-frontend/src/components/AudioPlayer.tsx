import { useCallback, useEffect, useRef, useState } from "react";
import { useWaveform } from "../hooks/useWaveform";

interface Props {
  src: string;
  downloadName?: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src, downloadName = "audio.wav" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveform = useWaveform(src);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // draw waveform
  const draw = useCallback(
    (pct: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !waveform) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, w, h);

      const barCount = waveform.length;
      const gap = 2;
      const barW = Math.max(1, (w - gap * barCount) / barCount);
      const minH = 3;

      const isDark = document.documentElement.classList.contains("dark");
      const playedColor = isDark ? "#818cf8" : "#4f46e5";
      const unplayedColor = isDark ? "#374151" : "#d1d5db";

      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + gap);
        const barH = Math.max(minH, waveform[i] * (h * 0.85));
        const y = (h - barH) / 2;
        const ratio = i / barCount;

        ctx.fillStyle = ratio <= pct ? playedColor : unplayedColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 1.5);
        ctx.fill();
      }
    },
    [waveform],
  );

  useEffect(() => {
    draw(progress);
  }, [waveform, progress, draw]);

  // audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setCurrentTime(audio.currentTime);
      }
    };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function seek(e: React.MouseEvent<HTMLCanvasElement>) {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !audio.duration) return;
    const rect = canvas.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  }

  return (
    <div className="animate-slide-up rounded-xl border border-white/40 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="w-full h-16 cursor-pointer rounded-lg"
        onClick={seek}
      />

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-600 hover:bg-brand-700 text-white transition-all hover:scale-105 active:scale-95"
        >
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 min-w-[70px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        <a
          href={src}
          download={downloadName}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
        >
          Telecharger
        </a>
      </div>
    </div>
  );
}
