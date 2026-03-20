import { useEffect, useMemo, useRef, useState } from "react";
import api, { dubVideo, listClonedVoices, type CloneListItem } from "../api";
import { toast } from "../hooks/useToast";
import DropZone from "../components/DropZone";
import StepProgress from "../components/StepProgress";
import Spinner from "../components/Spinner";

type LangCode = "fr" | "en" | "es" | "de";
type MixMode = "replace" | "mix_simple";

const STEPS = ["Upload", "Transcription", "Traduction", "Synthese", "Remux"];

// Estimated time (ms) per step for the simulated progress
const STEP_TIMINGS = [2000, 12000, 8000, 15000, 5000];

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");

  const [targetLang, setTargetLang] = useState<LangCode>("fr");
  const [mode, setMode] = useState<MixMode>("replace");

  const [useCloned, setUseCloned] = useState(false);
  const [voices, setVoices] = useState<CloneListItem[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");

  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  const [outVideo, setOutVideo] = useState<string>("");
  const [outVoice, setOutVoice] = useState<string>("");
  const [outSrt, setOutSrt] = useState<string>("");
  const [outTranscript, setOutTranscript] = useState<string>("");

  const stepTimer = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    let alive = true;
    if (!useCloned) return;
    (async () => {
      try {
        const v = await listClonedVoices();
        if (!alive) return;
        setVoices(v);
        if (v.length) setSelectedVoiceId((prev) => prev || v[0].voice_id);
      } catch (e: unknown) {
        console.error("Failed to load cloned voices:", e);
      }
    })();
    return () => { alive = false; };
  }, [useCloned]);

  const canRun = useMemo(() => !!file && (!useCloned || !!selectedVoiceId), [file, useCloned, selectedVoiceId]);

  function onPickVideo(files: File[]) {
    const f = files[0] ?? null;
    setFile(f);
    clearResults();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (f) setVideoUrl(URL.createObjectURL(f));
    else setVideoUrl("");
  }

  function clearResults() {
    setOutVideo("");
    setOutVoice("");
    setOutSrt("");
    setOutTranscript("");
    setStepStatus("idle");
    setCurrentStep(0);
  }

  function startSimulatedProgress() {
    // Clear previous timers
    stepTimer.current.forEach(clearTimeout);
    stepTimer.current = [];

    setCurrentStep(0);
    setStepStatus("running");

    let elapsed = 0;
    for (let i = 1; i < STEPS.length; i++) {
      elapsed += STEP_TIMINGS[i - 1];
      const step = i;
      const t = setTimeout(() => setCurrentStep(step), elapsed);
      stepTimer.current.push(t);
    }
  }

  function stopSimulatedProgress() {
    stepTimer.current.forEach(clearTimeout);
    stepTimer.current = [];
  }

  async function handleDub() {
    if (!file) return;
    setRunning(true);
    clearResults();
    startSimulatedProgress();

    try {
      const res = await dubVideo({
        file,
        target_lang: targetLang,
        mode,
        voice_id: useCloned && selectedVoiceId ? selectedVoiceId : null,
      });

      stopSimulatedProgress();
      setCurrentStep(STEPS.length - 1);
      setStepStatus("done");

      const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
      setOutVideo(`${base}${res.outputs.video}`);
      setOutVoice(`${base}${res.outputs.voice_wav}`);
      setOutSrt(`${base}${res.outputs.srt}`);
      setOutTranscript(`${base}${res.outputs.transcript}`);

      toast.success("Doublage termine !");
    } catch (e: unknown) {
      stopSimulatedProgress();
      setStepStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur de doublage.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="card">
        <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">
          Traduire & Doubler
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Upload une video, choisis la langue cible et lance. Le pipeline fait
          transcription, traduction, clonage voix et remux MP4 automatiquement.
        </p>

        <div className="grid gap-5">
          {/* Video upload */}
          <div>
            <label className="label">Video</label>
            <DropZone
              accept="video/*"
              label="Deposer une video"
              hint="MP4, MOV, MKV, WebM — max 25 Mo"
              onFiles={onPickVideo}
              files={file ? [file] : []}
            />
            {videoUrl && (
              <video
                controls
                src={videoUrl}
                className="mt-4 w-full rounded-xl shadow-soft dark:shadow-none border border-gray-200 dark:border-white/10"
              />
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Langue cible</label>
              <select className="input-base" value={targetLang} onChange={(e) => setTargetLang(e.target.value as LangCode)}>
                <option value="fr">Francais</option>
                <option value="en">English</option>
                <option value="es">Espanol</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <div>
              <label className="label">Mixage</label>
              <select className="input-base" value={mode} onChange={(e) => setMode(e.target.value as MixMode)}>
                <option value="replace">Remplacer la piste</option>
                <option value="mix_simple">Garder l'ambiance (mix)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 md:pt-6">
              <input
                id="usecloned"
                type="checkbox"
                className="h-4 w-4 rounded accent-brand-600"
                checked={useCloned}
                onChange={(e) => setUseCloned(e.target.checked)}
              />
              <label htmlFor="usecloned" className="text-sm text-gray-700 dark:text-gray-300">
                Utiliser ma voix clonee
              </label>
            </div>
          </div>

          {/* Voice selector */}
          {useCloned && (
            <div className="animate-fade-in">
              <label className="label">Voix clonee</label>
              <select
                className="input-base"
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.clips} clips)
                  </option>
                ))}
              </select>
              {voices.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Aucune voix. Va dans l'onglet Voice Cloning pour en creer une.
                </p>
              )}
            </div>
          )}

          {/* Progress */}
          {stepStatus !== "idle" && (
            <div className="animate-fade-in">
              <StepProgress steps={STEPS} current={currentStep} status={stepStatus} />
            </div>
          )}

          {/* CTA */}
          <button className="btn" onClick={handleDub} disabled={!canRun || running}>
            {running ? <><Spinner /> Doublage en cours...</> : "Traduire & Doubler"}
          </button>
        </div>
      </section>

      {/* Results */}
      {outVideo && (
        <section className="card animate-slide-up">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Resultat</h3>
          <video
            controls
            src={outVideo}
            className="w-full rounded-xl shadow-soft dark:shadow-none border border-gray-200 dark:border-white/10"
          />
          <div className="flex gap-4 flex-wrap mt-4">
            {outVoice && (
              <a className="text-sm text-brand-600 dark:text-brand-400 hover:underline" href={outVoice} download>
                Voix (WAV)
              </a>
            )}
            {outSrt && (
              <a className="text-sm text-brand-600 dark:text-brand-400 hover:underline" href={outSrt} download>
                Sous-titres (SRT)
              </a>
            )}
            {outTranscript && (
              <a className="text-sm text-brand-600 dark:text-brand-400 hover:underline" href={outTranscript} download>
                Transcript (JSON)
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
