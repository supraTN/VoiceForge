import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 60000,
});

// ⚠️ Dev seulement : identifiant utilisateur côté front pour tester.
// En prod: le back métier (Express) ajoute le user_id et le token.
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID ?? "demo-user";
// Optionnel: si tu as mis un token côté FastAPI (TTS_BEARER), tu peux le tester en dev.
// ⚠️ Ne JAMAIS exposer de vrai secret en prod.
const DEV_BEARER = import.meta.env.VITE_API_TOKEN; // ex: "dev-token"

api.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["X-User-Id"] = DEV_USER_ID;
  if (DEV_BEARER) config.headers["Authorization"] = `Bearer ${DEV_BEARER}`;
  return config;
});

export type VoicesResponse = { lang_code: string; voices: string[] };

export async function fetchVoices(lang: string): Promise<VoicesResponse> {
  const res = await api.get<VoicesResponse>("/voices", { params: { lang } });
  return res.data;
}

export async function tts(params: {
  text: string;
  lang_code: string;
  voice?: string;
  speed?: number;
}): Promise<Blob> {
  const res = await api.post("/tts", params, { responseType: "blob" });
  return res.data;
}

/* --------- CLONAGE --------- */
export type CloneListItem = { voice_id: string; name: string; clips: number };
export type CloneEnrollResp = { voice_id: string; name: string };

export async function listClonedVoices(): Promise<CloneListItem[]> {
  const res = await api.get<CloneListItem[]>("/clone/voices");
  return res.data;
}

export async function enrollClonedVoice(name: string, files: File[]): Promise<CloneEnrollResp> {
  const fd = new FormData();
  fd.append("name", name);
  files.forEach((f) => fd.append("files", f, f.name));
  const res = await api.post<CloneEnrollResp>("/clone/enroll", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function ttsCloned(params: { text: string; lang_code: string; voice_id: string }): Promise<Blob> {
  const res = await api.post("/tts/cloned", params, { responseType: "blob" });
  return res.data;
}


// --- Étape 1 : Transcription vidéo ---
export type AsrSegment = { start: number; end: number; text: string };
export type TranscribeResponse = { language: string | null; segments: AsrSegment[] };

export async function transcribeVideo(file: File): Promise<TranscribeResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post("/video/transcribe", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 0, // premières charges de modèle peuvent être longues
  });
  return res.data as TranscribeResponse;
}

// --- Étape 2 : Traduction par segment ---
export type VideoTranslateReq = {
  target_lang: string;
  source_language?: string | null;
  segments: AsrSegment[];
};

export type VideoTranslateResp = {
  target_language: string;
  source_language?: string | null;
  segments: { start: number; end: number; text_src: string; text_tgt: string }[];
};

export async function translateVideoSegments(payload: VideoTranslateReq): Promise<VideoTranslateResp> {
  const res = await api.post("/video/translate", payload, { timeout: 0 });
  return res.data as VideoTranslateResp;
}

export type DubResponse = {
  job_id: string;
  detected_language: string | null;
  outputs: { video: string; voice_wav: string; srt: string; transcript: string };
};

export async function dubVideo(params: {
  file: File;
  target_lang: string;
  mode?: "replace" | "mix_simple";
  voice_id?: string | null;
  segments?: { start: number; end: number; text?: string; text_tgt?: string }[];
}): Promise<DubResponse> {
  const fd = new FormData();
  fd.append("file", params.file);
  fd.append("target_lang", params.target_lang);
  fd.append("mode", params.mode ?? "replace");
  if (params.voice_id) fd.append("use_voice_id", params.voice_id);
  if (params.segments && params.segments.length) {
    fd.append("segments_json", JSON.stringify({ segments: params.segments }));
  }
  const res = await api.post("/video/dub", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 0,
  });
  return res.data as DubResponse;
}




export default api;
