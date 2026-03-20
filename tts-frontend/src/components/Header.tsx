import { useDarkMode } from "../hooks/useDarkMode";
import Logo from "./Logo";

export default function Header() {
  const [isDark, toggle] = useDarkMode();

  return (
    <header className="sticky top-0 z-20 border-b border-white/30 dark:border-white/[0.06] bg-white/60 dark:bg-surface-900/60 backdrop-blur-xl">
      <div className="container-nice h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-bold text-gray-900 dark:text-white tracking-tight">VoiceForge</span>
        </div>

        <button
          onClick={toggle}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center
                     hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200
                     active:scale-90"
          aria-label="Toggle dark mode"
        >
          {/* Sun */}
          <svg
            className={`w-5 h-5 absolute transition-all duration-300 ${
              isDark ? "opacity-100 rotate-0 text-amber-400" : "opacity-0 rotate-90 text-amber-400"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M8.34 15.66l-1.41 1.41m12.14 0l-1.41-1.41M8.34 8.34L6.93 6.93" />
          </svg>

          {/* Moon */}
          <svg
            className={`w-5 h-5 absolute transition-all duration-300 ${
              isDark ? "opacity-0 -rotate-90 text-gray-600" : "opacity-100 rotate-0 text-gray-600"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
