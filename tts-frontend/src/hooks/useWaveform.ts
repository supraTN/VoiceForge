import { useEffect, useState } from "react";

const BAR_COUNT = 120;

export function useWaveform(audioUrl: string): Float32Array | null {
  const [data, setData] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setData(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(buf);
        await ctx.close();

        if (cancelled) return;

        const raw = decoded.getChannelData(0);
        const step = Math.floor(raw.length / BAR_COUNT);
        const bars = new Float32Array(BAR_COUNT);

        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * step;
          for (let j = start; j < start + step && j < raw.length; j++) {
            sum += Math.abs(raw[j]);
          }
          bars[i] = sum / step;
        }

        // normalize to 0..1
        const max = Math.max(...bars) || 1;
        for (let i = 0; i < BAR_COUNT; i++) {
          bars[i] /= max;
        }

        setData(bars);
      } catch {
        if (!cancelled) setData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return data;
}
