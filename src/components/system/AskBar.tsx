"use client";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { ArrowRight, EnterIcon, Spinner } from "./icons";
import { Kbd } from "./Kbd";

/**
 * Where a question starts. Plain English in; suggested questions for a
 * first visit; `/` focuses it from anywhere on the page.
 */
export const AskBar = forwardRef<
  HTMLInputElement,
  {
    onAsk: (question: string) => void;
    onCancel?: () => void;
    suggestions?: string[];
    running?: boolean;
    disabled?: boolean;
    defaultValue?: string;
    trailing?: React.ReactNode;
    /** Accessible name for the search landmark; must be unique per page. */
    label?: string;
    id?: string;
  }
>(function AskBar({ onAsk, onCancel, suggestions = [], running, disabled, defaultValue = "", trailing, label = "Ask the agent", id = "ask" }, ref) {
  const [value, setValue] = useState(defaultValue);
  const q = value.trim();
  const valid = q.length >= 3 && q.length <= 300;

  return (
    <div>
      <form
        role="search"
        aria-label={label}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !running) onAsk(q);
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-surface py-1.5 pr-1.5 pl-4 shadow-1 transition-colors",
          "focus-within:border-ink-3 focus-within:shadow-2",
          disabled ? "border-rule bg-sunk" : "border-rule-strong",
        )}
      >
        <span aria-hidden className="font-mono text-sm text-ink-3 select-none">
          ask ›
        </span>
        <label htmlFor={id} className="sr-only">
          Ask a question about Northwind Cloud&apos;s data
        </label>
        <input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          maxLength={300}
          autoComplete="off"
          placeholder="Ask a business question in plain English"
          className="h-9 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        {!value && !running && <Kbd className="hidden sm:inline-flex">/</Kbd>}
        {trailing}
        {running ? (
          <Button variant="secondary" onClick={onCancel} disabled={!onCancel}>
            <Spinner size={14} /> Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!valid || disabled}>
            Ask <EnterIcon size={14} className="opacity-70" />
          </Button>
        )}
      </form>
      {suggestions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={running || disabled}
                onClick={() => {
                  setValue(s);
                  onAsk(s);
                }}
                className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-rule bg-transparent px-3 text-sm text-ink-2 transition-colors hover:border-rule-strong hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                {s}
                <ArrowRight size={12} className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
