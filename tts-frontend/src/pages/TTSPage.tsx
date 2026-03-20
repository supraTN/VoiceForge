import { useEffect, useMemo, useState } from "react";
import { fetchVoices, tts } from "../api";
import { toast } from "../hooks/useToast";
import type { Lang } from "../types";
import AudioPlayer from "../components/AudioPlayer";
import CharCounter from "../components/CharCounter";
import Skeleton from "../components/Skeleton";
import Spinner from "../components/Spinner";

const MAX_CHARS = 2000;

export default function TTSPage() {
  const [text, setText] = useState("Bonjour, ceci est un test.");
  const [lang, setLang] = useState<Lang>("f");
  const [voices, setVoices] = useState<string[]>([]);
  const [voice, setVoice] = useState<string>("");
  const [speed, setSpeed] = useState(1.0);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setLoadingVoices(true);
    (async () => {
      try {
        const data = await fetchVoices(lang);
        if (!alive) return;
        const list = Array.isArray(data?.voices) ? data.voices : [];
        setVoices(list);
        setVoice(list[0] ?? "");
      } catch (e: unknown) {
        if (!alive) return;
        setVoices([]);
        setVoice("");
        toast.error(e instanceof Error ? e.message : "Erreur lors du chargement des voix.");
      } finally {
        if (alive) setLoadingVoices(false);
      }
    })();
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const canSubmit = useMemo(
    () => text.trim().length > 0 && text.length <= MAX_CHARS && !!voice && speed >= 0.5 && speed <= 1.5,
    [text, voice, speed],
  );

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const blob = await tts({ text, lang_code: lang, voice, speed });
      setAudioUrl(URL.createObjectURL(blob));
      toast.success("Audio genere avec succes !");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la generation.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={handleGenerate} className="grid gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Langue */}
          <div>
            <label className="label">Langue</label>
            <select
              className="input-base"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              <option value="f">Francais</option>
              <option value="a">English (US)</option>
              <option value="b">English (UK)</option>
            </select>
          </div>

          {/* Voix */}
          <div>
            <label className="label">Voix</label>
            {loadingVoices ? (
              <Skeleton h="h-10" />
            ) : (
              <select
                className="input-base"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={voices.length === 0}
              >
                {voices.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
            {!loadingVoices && voices.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Aucune voix disponible.</p>
            )}
          </div>
        </div>

        {/* Vitesse */}
        <div>
          <div className="label">
            Vitesse
            <span className="ml-2 inline-block rounded-md bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 text-xs font-mono text-brand-700 dark:text-brand-300">
              {speed.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            className="w-full accent-brand-600"
            min={0.5}
            max={1.5}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>

        {/* Texte */}
        <div>
          <label className="label">Texte</label>
          <textarea
            className="input-base"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Saisis ton texte..."
          />
          <CharCounter current={text.length} max={MAX_CHARS} />
        </div>

        {/* CTA */}
        <button type="submit" disabled={!canSubmit || loading} className="btn">
          {loading ? <><Spinner /> Generation en cours...</> : "Generer l'audio"}
        </button>
      </form>

      {/* Audio Player */}
      {audioUrl && (
        <div className="mt-6">
          <AudioPlayer src={audioUrl} downloadName="tts.wav" />
        </div>
      )}
    </div>
  );
}
