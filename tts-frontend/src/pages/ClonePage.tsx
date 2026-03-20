import { useEffect, useMemo, useState } from "react";
import { enrollClonedVoice, listClonedVoices, ttsCloned } from "../api";
import type { CloneListItem } from "../api";
import { toast } from "../hooks/useToast";
import type { Lang } from "../types";
import AudioPlayer from "../components/AudioPlayer";
import CharCounter from "../components/CharCounter";
import DropZone from "../components/DropZone";
import Skeleton from "../components/Skeleton";
import Spinner from "../components/Spinner";

const MAX_CHARS = 2000;

export default function ClonePage() {
  // Synthese
  const [text, setText] = useState("Bonjour, test avec ma voix clonee.");
  const [lang, setLang] = useState<Lang>("f");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Enrolement
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  // Voix existantes
  const [voices, setVoices] = useState<CloneListItem[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [loadingVoices, setLoadingVoices] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingVoices(true);
      try {
        const v = await listClonedVoices();
        if (!alive) return;
        setVoices(v);
        if (v.length && !selectedVoiceId) setSelectedVoiceId(v[0].voice_id);
      } catch (e: unknown) {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : "Erreur chargement des voix clonees.");
      } finally {
        if (alive) setLoadingVoices(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const canEnroll = useMemo(() => {
    return name.trim().length > 1 && files.length >= 1 && files.length <= 3;
  }, [name, files]);

  const canGenerate = useMemo(() => {
    return text.trim().length > 0 && text.length <= MAX_CHARS && !!selectedVoiceId;
  }, [text, selectedVoiceId]);

  function onPickFiles(picked: File[]) {
    const filtered = picked
      .filter((f) =>
        f.name.toLowerCase().endsWith(".wav") ||
        /audio\/(wav|x-wav)/i.test(f.type),
      )
      .slice(0, 3);
    setFiles(filtered);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!canEnroll || enrolling) return;
    setEnrolling(true);
    try {
      const resp = await enrollClonedVoice(name.trim(), files);
      toast.success(`Voix "${resp.name}" creee !`);
      const v = await listClonedVoices();
      setVoices(v);
      setSelectedVoiceId(resp.voice_id);
      setFiles([]);
      setName("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'enrolement.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate || generating) return;
    setGenerating(true);
    try {
      const blob = await ttsCloned({ text, lang_code: lang, voice_id: selectedVoiceId });
      setAudioUrl(URL.createObjectURL(blob));
      toast.success("Audio clone genere !");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur synthese clonee.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Col gauche : enrolement */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">Creer une voix clonee</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload 1 a 3 fichiers WAV (10-60s au total). Parole claire, sans bruit.
        </p>

        <form onSubmit={handleEnroll} className="grid gap-4">
          <div>
            <label className="label">Nom de la voix</label>
            <input
              className="input-base"
              placeholder="Ma voix FR"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
            />
          </div>

          <div>
            <label className="label">Fichiers audio</label>
            <DropZone
              accept="audio/wav,audio/x-wav"
              multiple
              maxFiles={3}
              label="Deposer des fichiers WAV"
              hint="Max 3 fichiers, 25 Mo au total"
              onFiles={onPickFiles}
              files={files}
            />
          </div>

          <button className="btn" type="submit" disabled={!canEnroll || enrolling}>
            {enrolling ? <><Spinner /> Enrolement...</> : "Creer la voix"}
          </button>
        </form>
      </section>

      {/* Col droite : synthese */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">Essayer ma voix</h2>

        <form onSubmit={handleGenerate} className="grid gap-4">
          <div>
            <label className="label">Voix clonee</label>
            {loadingVoices ? (
              <Skeleton h="h-10" />
            ) : (
              <select
                className="input-base"
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                disabled={voices.length === 0}
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.clips} clips)
                  </option>
                ))}
              </select>
            )}
            {!loadingVoices && voices.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Aucune voix. Cree-en une a gauche.
              </p>
            )}
          </div>

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

          <div>
            <label className="label">Texte</label>
            <textarea
              className="input-base"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tape ton texte..."
            />
            <CharCounter current={text.length} max={MAX_CHARS} />
          </div>

          <button className="btn" type="submit" disabled={!canGenerate || generating}>
            {generating ? <><Spinner /> Generation...</> : "Generer"}
          </button>
        </form>

        {/* Audio */}
        {audioUrl && (
          <div className="mt-6">
            <AudioPlayer src={audioUrl} downloadName="tts_cloned.wav" />
          </div>
        )}
      </section>
    </div>
  );
}
