"use client";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";
import type { StepStatus } from "@/lib/schemas";
import { BlockIcon, CheckIcon, PendingIcon, SkipIcon, Spinner, WarnIcon } from "./icons";

const icon: Record<StepStatus, React.ReactNode> = {
  pending: <PendingIcon size={14} className="text-ink-3" />,
  running: <Spinner size={14} className="text-ink" />,
  done: <CheckIcon size={14} className="text-pass" />,
  warn: <WarnIcon size={14} className="text-warn" />,
  error: <BlockIcon size={14} className="text-block" />,
  skipped: <SkipIcon size={14} className="text-ink-3" />,
};
const statusText: Record<StepStatus, string> = { pending: "pending", running: "running", done: "done", warn: "done with warnings", error: "failed", skipped: "skipped" };

/**
 * One step of the agent's work. Status moves pending → running → done/warn/
 * error; the human-readable label cross-fades as it changes, and a detail
 * line shows live progress (what the model is reasoning about right now).
 */
export function AgentStep({
  index,
  name,
  status,
  label,
  detail,
  model,
  elapsedMs,
  last,
}: {
  index: number;
  name: string;
  status: StepStatus;
  label?: string;
  detail?: string;
  model?: string;
  elapsedMs?: number;
  last?: boolean;
}) {
  const active = status === "running";
  return (
    <li className="relative grid grid-cols-[1.25rem_1fr] gap-x-3" aria-current={active ? "step" : undefined}>
      {!last && <span aria-hidden className={cn("absolute top-6 bottom-0 left-[0.6rem] w-px", status === "pending" ? "bg-rule" : "bg-rule-strong")} />}
      <span className="relative z-[1] mt-0.5 grid size-5 place-items-center rounded-full bg-paper">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: duration.fast, ease: ease.emphasized }} className="grid place-items-center">
            {icon[status]}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className={cn("min-w-0 pb-5", last && "pb-0")}>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xs text-ink-3 tabular">{String(index).padStart(2, "0")}</span>
          <span className={cn("text-xs font-medium tracking-wide uppercase", status === "pending" ? "text-ink-3" : "text-ink-2")}>{name}</span>
          <span className="sr-only">{statusText[status]}</span>
          {elapsedMs !== undefined && status !== "pending" && <span className="ml-auto font-mono text-2xs text-ink-3 tabular">{(elapsedMs / 1000).toFixed(1)}s</span>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={label ?? "none"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className={cn("mt-0.5 text-sm", status === "pending" ? "text-ink-3" : "text-ink")}
          >
            {label ?? "Waiting"}
          </motion.p>
        </AnimatePresence>
        {active && detail && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-3 italic" aria-live="polite">
            {detail}
          </p>
        )}
        {model && status !== "pending" && <p className="mt-1 font-mono text-2xs text-ink-3">{model}</p>}
      </div>
    </li>
  );
}
