interface Props {
  current: number;
  max: number;
  warnAt?: number;
}

export default function CharCounter({ current, max, warnAt = Math.floor(max * 0.8) }: Props) {
  const pct = Math.min(current / max, 1);
  const color =
    current >= max
      ? "text-red-500"
      : current >= warnAt
        ? "text-amber-500"
        : "text-gray-400 dark:text-gray-500";

  const barColor =
    current >= max
      ? "bg-red-500"
      : current >= warnAt
        ? "bg-amber-500"
        : "bg-brand-500";

  return (
    <div className="mt-1 space-y-1">
      <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className={`text-xs font-mono text-right transition-colors duration-200 ${color}`}>
        {current} / {max}
      </p>
    </div>
  );
}
