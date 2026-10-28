import { cn } from "@/lib/cn";
import { BlockIcon, CheckIcon, PendingIcon, Spinner, WarnIcon } from "./icons";

export type Verdict = "pass" | "warn" | "block" | "pending" | "reviewing";

const styles: Record<Verdict, { label: string; className: string; Icon: (p: { size?: number }) => React.ReactNode }> = {
  pass: { label: "Reviewed", className: "text-pass bg-pass-wash border-pass/25", Icon: CheckIcon },
  warn: { label: "Warning", className: "text-warn bg-warn-wash border-warn/30", Icon: WarnIcon },
  block: { label: "Blocked", className: "text-block bg-block-wash border-block/30", Icon: BlockIcon },
  pending: { label: "Not reviewed", className: "text-ink-3 bg-sunk border-rule", Icon: PendingIcon },
  reviewing: { label: "Reviewing", className: "text-ink-2 bg-sunk border-rule", Icon: ({ size }) => <Spinner size={size} /> },
};

/**
 * The reviewer agent's verdict on a query. Color never carries the meaning
 * alone: every verdict has its own icon and label.
 */
export function ReviewerBadge({
  verdict,
  label,
  size = "sm",
  rewritten,
  className,
}: {
  verdict: Verdict;
  label?: string;
  size?: "sm" | "md";
  rewritten?: boolean;
  className?: string;
}) {
  const s = styles[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-1.5 text-2xs" : "h-6 px-2 text-xs",
        s.className,
        className,
      )}
    >
      <s.Icon size={size === "sm" ? 12 : 14} />
      {label ?? s.label}
      {rewritten && <span className="font-normal">· fixed</span>}
    </span>
  );
}
