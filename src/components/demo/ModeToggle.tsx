"use client";
import { cn } from "@/lib/cn";

export type Mode = "cached" | "live";

/** Recorded runs are instant and free; live runs call the real agent. */
export function ModeToggle({ mode, onChange, disabled }: { mode: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Run mode" className="hidden shrink-0 items-center rounded-md bg-sunk p-0.5 text-xs sm:flex">
      {(["cached", "live"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          title={m === "cached" ? "Replay a recorded run of the real agent: instant, no API calls" : "Run the real agent against the database (rate limited)"}
          className={cn("flex h-7 items-center gap-1.5 rounded-sm px-2.5 transition-colors", mode === m ? "bg-surface font-medium text-ink shadow-1" : "text-ink-2 hover:text-ink")}
        >
          {m === "live" && <span className={cn("size-1.5 rounded-full", mode === "live" ? "bg-brand motion-safe:animate-pulse" : "bg-ink-3")} />}
          {m === "cached" ? "Recorded" : "Live"}
        </button>
      ))}
    </div>
  );
}
