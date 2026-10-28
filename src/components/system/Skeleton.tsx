import { cn } from "@/lib/cn";

/**
 * Placeholder shapes shown while data loads. They match the final layout so
 * nothing jumps when content resolves. The shimmer is motion-safe only.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "relative overflow-hidden rounded-xs bg-sunk",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.6s_var(--ease-standard)_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-surface/70 motion-safe:after:to-transparent",
        className,
      )}
    />
  );
}

/** Lines of text-height skeletons with a ragged right edge. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["92%", "78%", "86%", "64%", "72%"];
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

/** Chart-shaped skeleton: faint axis rules plus ghost marks in the final chart's form. */
export function SkeletonChart({ kind = "line", height = 180 }: { kind?: "line" | "bar" | "table"; height?: number }) {
  if (kind === "table") {
    return (
      <div className="space-y-2.5" style={{ height }} aria-hidden>
        {Array.from({ length: Math.floor(height / 28) }, (_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-3.5 flex-[3]" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    );
  }
  if (kind === "bar") {
    const bars = [0.9, 0.72, 0.61, 0.48, 0.4, 0.31];
    return (
      <div className="flex flex-col justify-between" style={{ height }} aria-hidden>
        {bars.map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 shrink-0" />
            <Skeleton className="h-4" style={{ width: `${w * 70}%` }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="relative" style={{ height }} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="absolute inset-x-0 border-t border-rule" style={{ top: `${(i / 3) * 100}%` }} />
      ))}
      <svg className="absolute inset-0 h-full w-full text-sunk" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M0 30 C 12 26, 20 28, 30 22 S 48 18, 58 20 S 78 10, 100 12" fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <Skeleton className="absolute inset-0 bg-transparent" />
    </div>
  );
}
