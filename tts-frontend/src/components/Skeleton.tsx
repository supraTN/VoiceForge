interface Props {
  className?: string;
  h?: string;
  w?: string;
}

export default function Skeleton({ className = "", h = "h-10", w = "w-full" }: Props) {
  return (
    <div
      className={`${h} ${w} rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
    />
  );
}

export function SkeletonGroup({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? "w-2/3" : "w-full"} h="h-4" />
      ))}
    </div>
  );
}
