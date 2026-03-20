import { useState } from "react";
import Background from "./components/Background";
import Header from "./components/Header";
import Tabs from "./components/Tabs";
import ToastContainer from "./components/Toast";
import TTSPage from "./pages/TTSPage";
import ClonePage from "./pages/ClonePage";
import VideoPage from "./pages/VideoPage";

export default function App() {
  const [tab, setTab] = useState<"tts" | "clone" | "video">("tts");

  return (
    <div className="relative min-h-dvh text-gray-900 dark:text-white transition-colors duration-300">
      <Background />
      <Header />
      <ToastContainer />

      <main className="container-nice py-10">
        {/* Hero */}
        <section className="mb-10 text-center animate-fade-in">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M5 11a1 1 0 0 0-2 0 9 9 0 0 0 8 8v3h2v-3a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" />
            </svg>
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-purple-500 dark:from-brand-400 dark:via-brand-300 dark:to-purple-400 bg-clip-text text-transparent">
              VoiceForge
            </span>
          </h1>
          <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-lg">
            Synthese vocale, clonage de voix et doublage video automatique.
          </p>
        </section>

        <Tabs
          items={[
            { key: "tts", label: "Text to Speech" },
            { key: "clone", label: "Voice Cloning" },
            { key: "video", label: "Video Dubbing" },
          ]}
          activeKey={tab}
          onChange={(k) => setTab(k as "tts" | "clone" | "video")}
        />

        <section className="mt-8">
          <div key={tab} className="animate-slide-up">
            {tab === "tts" ? <TTSPage /> : tab === "clone" ? <ClonePage /> : <VideoPage />}
          </div>
        </section>

        <footer className="mt-16 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
          VoiceForge — Projet scolaire &middot; React + FastAPI
        </footer>
      </main>
    </div>
  );
}
