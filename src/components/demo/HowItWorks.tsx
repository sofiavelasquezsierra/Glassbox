"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { duration, ease } from "@/lib/motion";
import { ChevronDown, InfoIcon } from "../system/icons";

/** Plain statement of what's real here: fictional data, real Claude calls, real read-only SQL. */
export function HowItWorks({ leading }: { leading?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
      {leading}
      <button type="button" aria-expanded={open} aria-controls="how-it-works" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
        <InfoIcon size={14} /> How this works
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="how-it-works" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.standard }} className="basis-full overflow-hidden">
            <ul className="mt-3 grid gap-x-8 gap-y-2 rounded-md border border-rule bg-surface p-4 text-ink-2 sm:grid-cols-2">
              <li>
                <strong className="font-medium text-ink">The data is fictional.</strong> Northwind Cloud is a made-up SaaS company; its 12 months of data are generated from a fixed seed in a real Supabase Postgres database. &ldquo;Today&rdquo; is pinned to Oct 28, 2026.
              </li>
              <li>
                <strong className="font-medium text-ink">The agent and the reviewer are Claude.</strong> Claude Haiku classifies the question, Claude Sonnet plans and writes SQL, and a separate Claude Opus call with its own prompt reviews every query before it runs.
              </li>
              <li>
                <strong className="font-medium text-ink">Queries really run, read-only.</strong> Each one is parsed to make sure it&apos;s a single SELECT, checked with EXPLAIN, then executed as a database role that can only read the demo schema, with a 5 s timeout.
              </li>
              <li>
                <strong className="font-medium text-ink">Recorded vs. live.</strong> Recorded runs replay a real agent trace instantly at no cost. Live runs call the agent for real and are rate limited. Editing an assumption always re-runs the SQL live; that needs no model call.
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
