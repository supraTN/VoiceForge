export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-brand-50/50 to-indigo-100 dark:from-surface-950 dark:via-surface-900 dark:to-brand-900/20 transition-colors duration-500" />

      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full animate-grid-fade opacity-30 dark:opacity-[0.08]">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-brand-300 dark:text-brand-500" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-brand-400/20 dark:bg-brand-500/10 blur-[100px] animate-float-1" />
      <div className="absolute top-[40%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-400/15 dark:bg-purple-500/10 blur-[100px] animate-float-2" />
      <div className="absolute bottom-[-5%] left-[30%] w-[350px] h-[350px] rounded-full bg-pink-300/15 dark:bg-pink-500/[0.07] blur-[100px] animate-float-3" />
      <div className="absolute top-[20%] left-[50%] w-[250px] h-[250px] rounded-full bg-cyan-300/10 dark:bg-cyan-500/[0.05] blur-[80px] animate-float-2" />

      {/* Top radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-brand-500/10 to-transparent dark:from-brand-500/[0.07] rounded-full blur-[60px]" />
    </div>
  );
}
