import { createPortal } from "react-dom";
import { useToasts } from "../hooks/useToast";

const variantStyles: Record<string, string> = {
  success:
    "bg-emerald-50 dark:bg-emerald-900/80 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200",
  error:
    "bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200",
  info:
    "bg-brand-50 dark:bg-brand-900/80 border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-200",
};

const barColors: Record<string, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-brand-500",
};

export default function ToastContainer() {
  const [toasts, dismiss] = useToasts();

  if (!toasts.length) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-up rounded-xl border p-4 shadow-lg backdrop-blur cursor-pointer ${variantStyles[t.variant]}`}
          onClick={() => dismiss(t.id)}
        >
          <p className="text-sm font-medium pr-4">{t.message}</p>
          <div className="mt-2 h-0.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${barColors[t.variant]}`}
              style={{
                animation: `shrink ${t.duration}ms linear forwards`,
              }}
            />
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
