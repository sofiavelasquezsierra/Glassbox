"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CACHED_RUNS, findCached } from "@/data/runs";
import { SUGGESTED } from "@/data/suggested";
import { useAgentRun } from "@/lib/use-agent-run";
import { useDictionary } from "@/lib/use-dictionary";
import { AskBar } from "../system/AskBar";
import { Button } from "../system/Button";
import { EmptyState } from "../system/EmptyState";
import { DatabaseIcon } from "../system/icons";
import { Kbd } from "../system/Kbd";
import { ProvenancePanel } from "../system/ProvenancePanel";
import { ActivityRail } from "./ActivityRail";
import { Dashboard, displayOrder } from "./Dashboard";
import { HowItWorks } from "./HowItWorks";
import { ModeToggle, type Mode } from "./ModeToggle";
import { WalkthroughVideo } from "./WalkthroughVideo";


const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function Demo() {
  const { state, start, cancel, editAssumption, resetAssumption, undo } = useAgentRun();
  const dictionary = useDictionary();
  const [mode, setMode] = useState<Mode>(CACHED_RUNS.length ? "cached" : "live");
  const [panelId, setPanelId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const order = displayOrder(state);

  const ask = useCallback(
    (question: string) => {
      setPanelId(null);
      setSelected(null);
      const cached = findCached(question);
      // Recorded mode only covers recorded questions; anything else runs live.
      const runMode: Mode = mode === "cached" && cached ? "cached" : "live";
      void start({
        question,
        mode: runMode,
        dictionary: dictionary.accepted,
        cached,
        fallback: (reason) => {
          const c = findCached(question) ?? CACHED_RUNS[0];
          return c ? { ...c, question: c.question } : undefined;
        },
      });
      if (runMode === "live" && mode === "cached" && !cached) setMode("live");
    },
    [mode, start, dictionary.accepted],
  );

  // Keyboard: / focuses ask, J/K move between charts, Enter opens provenance, ⌘Z undoes an assumption edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !isTyping(e.target) && state.history.length) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || panelId) return;
      if (e.key === "/") {
        e.preventDefault();
        askRef.current?.focus();
        askRef.current?.select();
      } else if ((e.key === "j" || e.key === "k") && order.length) {
        e.preventDefault();
        const next = selected === null ? 0 : Math.min(order.length - 1, Math.max(0, selected + (e.key === "j" ? 1 : -1)));
        setSelected(next);
        const el = cardRefs.current[next];
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } else if (e.key === "Enter" && selected !== null && document.activeElement === cardRefs.current[selected]) {
        e.preventDefault();
        setPanelId(order[selected] ?? null);
      } else if (e.key === "Escape" && selected !== null) {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, selected, panelId, state.history.length, undo]);

  const panelView = panelId ? (state.metrics[panelId] ?? null) : null;
  const running = state.status === "running";

  return (
    <main className="mx-auto max-w-[1280px] px-4 pt-8 pb-20 sm:px-6">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="eyebrow">A design-engineering demo</p>
          <h1 className="display mt-3 max-w-3xl text-4xl text-ink uppercase sm:text-5xl lg:text-6xl">
            An analyst that
            <br />
            <span className="text-brand-ink">shows its work</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-2">
            Ask a question about a fictional SaaS company. The agent states its assumptions, writes SQL, has a second agent review it, runs it read-only against Supabase, and every number links back to the query and rows behind it.
          </p>
          <div className="mt-6">
            <HowItWorks
              leading={
                <Button variant="primary" onClick={() => askRef.current?.focus()}>
                  Ask a question
                </Button>
              }
            />
          </div>
        </div>
        <WalkthroughVideo />
      </section>

      <AskBar
        ref={askRef}
        onAsk={ask}
        onCancel={cancel}
        running={running}
        suggestions={SUGGESTED}
        trailing={<ModeToggle mode={mode} onChange={setMode} disabled={running} />}
      />
      <p className="mt-2 text-xs text-ink-3">
        {mode === "cached" ? "Recorded mode replays real agent runs for the suggested questions, instantly and at no cost. Other questions run live." : "Live mode calls Claude and the database for real. Runs are rate limited per visitor."}{" "}
        The agent reads {dictionary.accepted.length} accepted <Link href="/dictionary" className="underline decoration-rule-strong underline-offset-2 hover:text-ink">Data Dictionary</Link> entries.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="order-2 min-w-0 lg:order-1">
          {state.status === "idle" ? (
            <div className="rounded-lg border border-dashed border-rule-strong">
              <EmptyState icon={<DatabaseIcon />} title="Ask a question to build a dashboard" action={<Button variant="primary" onClick={() => ask(SUGGESTED[0]!)}>Try &ldquo;{SUGGESTED[0]}&rdquo;</Button>}>
                The agent reads the schema, makes its assumptions explicit, and shows every query it runs. Press <Kbd>/</Kbd> to start typing.
              </EmptyState>
            </div>
          ) : (
            <Dashboard state={state} selected={selected} onSelect={setSelected} onOpen={setPanelId} onEdit={editAssumption} onReset={resetAssumption} onUndo={undo} onRetry={() => ask(state.question)} cardRefs={cardRefs} />
          )}
        </div>
        <aside className={state.status === "idle" ? "hidden lg:order-2 lg:block" : "order-1 lg:order-2"}>
          <div className="lg:sticky lg:top-20">
            <ActivityRail state={state} />
            {order.length > 0 && (
              <p className="mt-3 hidden flex-wrap items-center gap-1.5 text-2xs text-ink-3 lg:flex">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd> charts <Kbd>Enter</Kbd> SQL <Kbd>/</Kbd> ask <Kbd>Esc</Kbd> close
              </p>
            )}
          </div>
        </aside>
      </div>

      <ProvenancePanel view={panelView} footnote={panelId ? state.order.indexOf(panelId) + 1 : undefined} reviewerModel={state.steps.review.model} onClose={() => setPanelId(null)} />
    </main>
  );
}
