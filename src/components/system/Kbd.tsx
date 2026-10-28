import { cn } from "@/lib/cn";

/** A keyboard key hint. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-rule-strong bg-surface px-1",
        "font-mono text-2xs text-ink-3 shadow-[0_1px_0_var(--rule-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
