"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { Assumption } from "@/lib/assumptions";
import { formatAssumption, presetLabel } from "@/lib/assumption-format";
import { cn } from "@/lib/cn";
import { DATE_RANGE_PRESETS, TIMEZONES } from "@/lib/constants";
import { duration, ease } from "@/lib/motion";
import { Button } from "./Button";
import { CheckIcon, ChevronDown, UndoIcon } from "./icons";

/**
 * An editable assumption the agent made. Clicking opens a typed editor.
 * Changed values are marked in amber with the original kept for undo;
 * assumptions no query uses are shown dashed, so it's clear editing them
 * would change nothing.
 */
export function AssumptionChip({
  assumption,
  original,
  onChange,
  onUndo,
  affects = 0,
  unused,
  busy,
  disabled,
}: {
  assumption: Assumption;
  /** The agent's value; when it differs from `assumption`, the chip shows as changed. */
  original?: Assumption;
  onChange?: (next: Assumption) => void;
  onUndo?: () => void;
  affects?: number;
  unused?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const changed = original !== undefined && JSON.stringify(original.value) !== JSON.stringify(assumption.value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const commit = (next: Assumption) => {
    onChange?.(next);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div ref={root} className="relative inline-flex">
      <div
        className={cn(
          "inline-flex h-8 items-stretch overflow-hidden rounded-md border text-sm transition-colors duration-[var(--dur-fast)]",
          changed ? "border-accent bg-accent-wash" : unused ? "border-dashed border-rule-strong bg-transparent" : "border-rule-strong bg-surface hover:border-ink-3",
        )}
      >
        <button
          ref={trigger}
          type="button"
          disabled={disabled || !onChange}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((o) => !o)}
          title={unused ? "No query uses this assumption" : assumption.rationale}
          className="flex items-center gap-1.5 pr-2 pl-2.5 disabled:cursor-default"
        >
          {changed && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
          <span className={cn("text-ink-2", unused && "text-ink-3")}>{assumption.label}</span>
          <span className={cn("font-mono text-xs", changed ? "font-medium text-accent-ink" : unused ? "text-ink-3" : "text-ink")}>{formatAssumption(assumption)}</span>
          {busy ? (
            <span className="ml-0.5 size-3 animate-pulse rounded-full bg-accent/60" aria-label="Re-running affected queries" />
          ) : (
            onChange && !disabled && <ChevronDown size={12} className="text-ink-3" />
          )}
          {changed && <span className="sr-only">changed from {formatAssumption(original!)}</span>}
        </button>
        {changed && onUndo && (
          <button type="button" onClick={onUndo} aria-label={`Undo ${assumption.label}, back to ${formatAssumption(original!)}`} title={`Undo (was ${formatAssumption(original!)})`} className="border-l border-accent/40 px-1.5 text-accent-ink hover:bg-accent/15">
            <UndoIcon size={13} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={`Edit ${assumption.label}`}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: duration.instant } }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="absolute top-full left-0 z-30 mt-1.5 w-72 origin-top-left rounded-md border border-rule bg-raised p-3 shadow-2"
          >
            <p className="text-sm font-medium text-ink">{assumption.label}</p>
            <p className="mt-0.5 mb-3 text-xs text-ink-2">{assumption.rationale}</p>
            <Editor assumption={assumption} onCommit={commit} />
            <p className="mt-3 border-t border-rule pt-2 text-2xs text-ink-3">
              {unused ? "No query uses this yet." : `Re-runs ${affects} ${affects === 1 ? "query" : "queries"} · no model calls`}
              {original && changed && <> · agent chose {formatAssumption(original)}</>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OptionList({ options, value, onPick, render }: { options: readonly string[]; value: string; onPick: (v: string) => void; render?: (v: string) => string }) {
  return (
    <ul className="max-h-56 space-y-0.5 overflow-auto" role="listbox" aria-label="Options">
      {options.map((o) => (
        <li key={o}>
          <button
            type="button"
            role="option"
            aria-selected={o === value}
            autoFocus={o === value}
            onClick={() => onPick(o)}
            className={cn("flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-sunk", o === value && "font-medium")}
          >
            {render ? render(o) : o.replace(/_/g, " ")}
            {o === value && <CheckIcon size={14} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Editor({ assumption: a, onCommit }: { assumption: Assumption; onCommit: (a: Assumption) => void }) {
  const [draft, setDraft] = useState(a.type === "int" ? String(a.value) : "");
  const [range, setRange] = useState(a.type === "date_range" && a.value.preset === "custom" ? a.value : { preset: "custom" as const, start: "2026-07-01", end: "2026-09-30" });

  switch (a.type) {
    case "int": {
      const n = Number(draft);
      const valid = Number.isInteger(n) && n >= a.min && n <= a.max;
      const quick = [...new Set([1, 7, 14, 30, 60, 90].filter((q) => q >= a.min && q <= a.max).concat(a.value))].sort((x, y) => x - y).slice(0, 6);
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onCommit({ ...a, value: n });
          }}
        >
          <div className="flex gap-2">
            <label className="flex h-8 flex-1 items-center rounded-sm border border-rule-strong bg-surface px-2 focus-within:outline-2 focus-within:outline-focus">
              <input autoFocus inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!valid} aria-label={a.label} className="w-full bg-transparent font-mono text-sm outline-none" />
              {a.unit && <span className="text-xs text-ink-3">{a.unit}</span>}
            </label>
            <Button type="submit" size="md" variant="primary" disabled={!valid} className="h-8">
              Apply
            </Button>
          </div>
          <p className={cn("mt-1 text-2xs", valid ? "text-ink-3" : "text-block")}>
            {a.min}–{a.max}
            {a.unit ? ` ${a.unit}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => onCommit({ ...a, value: q })} className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-xs", q === a.value ? "border-ink bg-ink text-ink-inverse" : "border-rule-strong hover:border-ink-3")}>
                {q}
              </button>
            ))}
          </div>
        </form>
      );
    }
    case "bool":
      return (
        <div className="grid grid-cols-2 gap-1 rounded-sm bg-sunk p-0.5" role="radiogroup" aria-label={a.label}>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={a.value === v} autoFocus={a.value === v} onClick={() => onCommit({ ...a, value: v })} className={cn("rounded-xs py-1.5 text-sm", a.value === v ? "bg-surface font-medium shadow-1" : "text-ink-2 hover:text-ink")}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );
    case "enum":
      return <OptionList options={a.options} value={a.value} onPick={(v) => onCommit({ ...a, value: v })} />;
    case "timezone":
      return <OptionList options={TIMEZONES} value={a.value} onPick={(v) => onCommit({ ...a, value: v as (typeof TIMEZONES)[number] })} render={(v) => v.replace(/_/g, " ")} />;
    case "date_range": {
      const presets = DATE_RANGE_PRESETS.filter((p) => p !== "custom");
      const validRange = range.start <= range.end && range.start >= "2025-11-01" && range.end <= "2026-10-28";
      return (
        <div>
          <OptionList options={presets} value={a.value.preset} onPick={(p) => onCommit({ ...a, value: { preset: p as (typeof presets)[number] } })} render={presetLabel} />
          <form
            className="mt-2 border-t border-rule pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (validRange) onCommit({ ...a, value: range });
            }}
          >
            <p className="eyebrow mb-1.5">Custom (inclusive)</p>
            <div className="flex items-center gap-1.5">
              <input type="date" aria-label="Start date" min="2025-11-01" max="2026-10-28" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className="h-8 min-w-0 flex-1 rounded-sm border border-rule-strong bg-surface px-1.5 font-mono text-xs" />
              <span className="text-ink-3">–</span>
              <input type="date" aria-label="End date" min="2025-11-01" max="2026-10-28" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className="h-8 min-w-0 flex-1 rounded-sm border border-rule-strong bg-surface px-1.5 font-mono text-xs" />
            </div>
            <Button type="submit" size="sm" variant="primary" disabled={!validRange} className="mt-2 w-full">
              Apply range
            </Button>
          </form>
        </div>
      );
    }
  }
}
