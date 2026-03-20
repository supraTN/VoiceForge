import { useLayoutEffect, useRef, useState } from "react";

type TabItem = { key: string; label: string; disabled?: boolean };

export default function Tabs({
  items,
  activeKey,
  onChange,
}: {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(`[data-tab="${activeKey}"]`);
    if (activeBtn) {
      setIndicator({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [activeKey]);

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <div
        ref={containerRef}
        className="relative inline-flex items-center gap-1 rounded-2xl
                   border border-white/40 dark:border-white/[0.08]
                   bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl
                   p-1.5 shadow-soft dark:shadow-none"
      >
        {/* Sliding indicator */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 shadow-md shadow-brand-500/25 transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />

        {items.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <button
              key={t.key}
              data-tab={t.key}
              className={`
                relative z-10 px-4 py-2 rounded-xl text-sm font-semibold
                transition-colors duration-200 whitespace-nowrap
                ${isActive ? "text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}
                ${t.disabled && !isActive ? "opacity-40 pointer-events-none" : ""}
              `}
              onClick={() => onChange(t.key)}
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
