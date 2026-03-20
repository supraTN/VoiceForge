import { useCallback, useRef, useState } from "react";

interface Props {
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  files?: File[];
}

function formatSize(n: number): string {
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let val = n;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function DropZone({
  accept,
  multiple = false,
  maxFiles = 1,
  label = "Deposer un fichier ici",
  hint,
  onFiles,
  files = [],
}: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files).slice(0, maxFiles);
      if (dropped.length) onFiles(dropped);
    },
    [maxFiles, onFiles],
  );

  const handlePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []).slice(0, maxFiles);
      if (picked.length) onFiles(picked);
      e.target.value = "";
    },
    [maxFiles, onFiles],
  );

  return (
    <div>
      <div
        className={`
          relative flex flex-col items-center justify-center gap-2
          rounded-xl border-2 border-dashed p-6 cursor-pointer
          transition-all duration-200
          ${
            dragging
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.01]"
              : files.length
                ? "border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10"
                : "border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-gray-50 dark:hover:bg-white/5"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handlePick}
        />

        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            dragging
              ? "bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300"
              : "bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4m-9 8h10a2 2 0 002-2v-1" />
          </svg>
        </div>

        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="animate-fade-in flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-1.5"
            >
              <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              </svg>
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
