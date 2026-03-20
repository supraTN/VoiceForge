interface Props {
  steps: string[];
  current: number; // 0-based index of the active step
  status: "idle" | "running" | "done" | "error";
}

export default function StepProgress({ steps, current, status }: Props) {
  return (
    <div className="flex items-center gap-1 w-full py-4">
      {steps.map((label, i) => {
        const isDone = status === "done" ? true : i < current;
        const isActive = status !== "done" && i === current;
        const isError = isActive && status === "error";

        return (
          <div key={i} className="flex items-center gap-1 flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-300
                  ${
                    isError
                      ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 ring-2 ring-red-400"
                      : isDone
                        ? "bg-brand-600 text-white shadow-md"
                        : isActive
                          ? "bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 ring-2 ring-brand-400 animate-pulse-slow"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                  }
                `}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                  isDone || isActive
                    ? "text-brand-700 dark:text-brand-300"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full mx-1 mt-[-18px] transition-colors duration-500">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDone
                      ? "bg-brand-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
