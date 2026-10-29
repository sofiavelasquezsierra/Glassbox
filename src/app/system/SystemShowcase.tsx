"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DataTable } from "@/components/charts/DataTable";
import { AgentStep } from "@/components/system/AgentStep";
import { AskBar } from "@/components/system/AskBar";
import { AssumptionChip } from "@/components/system/AssumptionChip";
import { Button } from "@/components/system/Button";
import { ChartFrame } from "@/components/system/ChartFrame";
import { DictionaryRow, type DictionaryRowData } from "@/components/system/DictionaryRow";
import { EmptyState } from "@/components/system/EmptyState";
import { ErrorState } from "@/components/system/ErrorState";
import { DatabaseIcon, PlayIcon, TableIcon } from "@/components/system/icons";
import { Kbd } from "@/components/system/Kbd";
import { MetricCard } from "@/components/system/MetricCard";
import { ProvenancePanel } from "@/components/system/ProvenancePanel";
import { ReviewerBadge } from "@/components/system/ReviewerBadge";
import { Skeleton, SkeletonChart, SkeletonText } from "@/components/system/Skeleton";
import { SQLBlock, SqlDiff } from "@/components/system/SQLBlock";
import { fixtures, fixtureSource } from "@/data/fixtures";
import type { Assumption } from "@/lib/assumptions";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";
import type { MetricView } from "@/lib/run-types";
import type { StepStatus } from "@/lib/schemas";

// ── Layout helpers ───────────────────────────────────────────────────────────

const SECTIONS = [
  ["foundations", "Foundations", ["color", "type", "space", "elevation", "motion"]],
  ["components", "Components", ["askbar", "agentstep", "assumptionchip", "metriccard", "chartframe", "sqlblock", "provenancepanel", "reviewerbadge", "dictionaryrow", "skeleton", "emptystate", "errorstate"]],
] as const;
const TITLES: Record<string, string> = {
  color: "Color",
  type: "Type",
  space: "Space & radius",
  elevation: "Elevation",
  motion: "Motion",
  askbar: "AskBar",
  agentstep: "AgentStep",
  assumptionchip: "AssumptionChip",
  metriccard: "MetricCard",
  chartframe: "ChartFrame",
  sqlblock: "SQLBlock",
  provenancepanel: "ProvenancePanel",
  reviewerbadge: "ReviewerBadge",
  dictionaryrow: "DictionaryRow",
  skeleton: "Skeleton",
  emptystate: "EmptyState",
  errorstate: "ErrorState",
};

function Section({ id, lede, children, props }: { id: string; lede: React.ReactNode; children: React.ReactNode; props?: [string, string, string][] }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t border-rule py-10 first:border-t-0 first:pt-0">
      <h3 id={`${id}-h`} className="font-mono text-base font-medium text-ink">
        {TITLES[id]}
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">{lede}</p>
      <div className="mt-5">{children}</div>
      {props && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-ink-2 hover:text-ink">Props</summary>
          <div className="mt-2 overflow-x-auto rounded-md border border-rule">
            <table className="w-full text-left text-xs">
              <thead className="bg-sunk font-mono text-2xs text-ink-3">
                <tr>
                  <th className="px-3 py-1.5 font-medium">prop</th>
                  <th className="px-3 py-1.5 font-medium">type</th>
                  <th className="px-3 py-1.5 font-medium">notes</th>
                </tr>
              </thead>
              <tbody>
                {props.map(([p, t, n]) => (
                  <tr key={p} className="border-t border-rule">
                    <td className="px-3 py-1.5 font-mono text-ink">{p}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-2">{t}</td>
                    <td className="px-3 py-1.5 text-ink-2">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function Specimen({ label, children, className, pad = true }: { label: string; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="eyebrow mb-1.5">{label}</figcaption>
      <div className={cn("rounded-md border border-dashed border-rule-strong bg-paper", pad && "p-4")}>{children}</div>
    </figure>
  );
}

// ── Foundations ──────────────────────────────────────────────────────────────

const COLOR_GROUPS: [string, [string, string][]][] = [
  ["Surfaces", [["--paper", "Page"], ["--surface", "Cards, chart surface"], ["--surface-sunk", "Code, wells, inputs"], ["--surface-raised", "Popovers, panels"]]],
  ["Ink", [["--ink", "Primary text · 17.9:1 dark"], ["--ink-2", "Secondary · 9.6:1 dark"], ["--ink-3", "Muted, axis labels · 5.9:1 dark"]]],
  ["Rules", [["--rule", "Hairlines"], ["--rule-strong", "Borders, axis"]]],
  ["Brand (actions and emphasis)", [["--brand", "Primary button, active nav"], ["--brand-ink", "Brand as text (darker on light)"], ["--brand-wash", "Selection, quiet fills"]]],
  ["Accent (assumptions only)", [["--accent", "Changed marker"], ["--accent-ink", "Changed value text"], ["--accent-wash", "Changed chip fill"]]],
  ["Verdicts (always with icon + label)", [["--pass", "Pass (teal, never the brand)"], ["--warn", "Warn"], ["--block", "Block"], ["--focus", "Focus ring"]]],
  ["Series (validated categorical order)", [["--series-1", "Slot 1 · blue"], ["--series-2", "Slot 2 · aqua"], ["--series-3", "Slot 3 · violet"], ["--series-4", "Slot 4 · magenta"]]],
];

function Foundations() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  return (
    <>
      <Section id="color" lede="Near-black surfaces with hairline rules, and one mint brand color for actions and emphasis. Amber is reserved for assumptions and changed values, so it always means “you or the agent chose this”. Pass is teal so it never reads as the brand, and verdict colors never double as chart series. Dark is the default; light has its own selected steps, contrast-checked, and isn't an inversion.">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {COLOR_GROUPS.map(([group, tokens]) => (
            <div key={group}>
              <p className="eyebrow mb-2">{group}</p>
              <ul className="space-y-1.5">
                {tokens.map(([v, role]) => (
                  <li key={v} className="flex items-center gap-3">
                    <span className="size-8 shrink-0 rounded-sm border border-rule" style={{ background: `var(${v})` }} />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-ink">{v}</span>
                      <span className="block text-xs text-ink-3">{role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-2xl text-xs text-ink-3">
          The series order was run through a colour-vision-deficiency validator: every adjacent pair separates by ΔE ≥ 16 under protan, deutan and tritan simulation in both modes. Slots 2 and 4 sit under 3:1 on the light surface, so every chart also has a row table one click away.
        </p>
      </Section>

      <Section id="type" lede="Two families with two jobs. Geist for the interface, display headings (heavy and tightly tracked, uppercase only in the hero) and every number on a dashboard, and Geist Mono for SQL, parameters, labels and provenance.">
        <div className="space-y-3">
          {[
            ["display text-6xl uppercase", "6xl · 84/80 · hero heading", "Shows its work"],
            ["text-4xl font-semibold tracking-tight", "4xl · 46/50 · hero figure", "8,412"],
            ["text-3xl font-medium tracking-tight", "3xl · 34/40", "Who are our most engaged organizations?"],
            ["text-2xl font-medium", "2xl · 26/34", "Retention this quarter"],
            ["text-xl font-medium", "xl · 20/28", "Provenance panel title"],
            ["text-lg", "lg · 17/26", "Lead paragraph text"],
            ["text-base", "base · 15/24", "Body text and inputs. The default size."],
            ["text-sm", "sm · 13/20", "Secondary text, descriptions, buttons"],
            ["text-xs", "xs · 12/18", "Captions, table cells, chart labels"],
            ["eyebrow", "2xs mono caps · 11/16", "Section marker"],
          ].map(([cls, name, sample]) => (
            <div key={name} className="grid grid-cols-1 items-baseline gap-1 border-b border-rule pb-3 sm:grid-cols-[12rem_1fr]">
              <span className="font-mono text-2xs text-ink-3">{name}</span>
              <span className={cn("truncate text-ink", cls)}>{sample}</span>
            </div>
          ))}
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <p className="font-sans text-lg text-ink">Geist: interface</p>
            <p className="font-mono text-base text-ink">Geist Mono: data</p>
            <p className="display text-xl text-ink">Geist display: headings</p>
          </div>
        </div>
      </Section>

      <Section id="space" lede="A 4px grid. Cards breathe at 16px; dense data rows at 4–6px. Radii stay small on surfaces (4–10px) and full-round on buttons: this is a tool, not a toy.">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
            <div key={n} className="text-center">
              <div className="bg-series-1/25 outline outline-series-1/40" style={{ width: n * 4, height: n * 4 }} />
              <p className="mt-1 font-mono text-2xs text-ink-3">{n * 4}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          {[
            ["rounded-xs", "xs · 3px"],
            ["rounded-sm", "sm · 4px"],
            ["rounded-md", "md · 6px"],
            ["rounded-lg", "lg · 10px"],
            ["rounded-full", "full"],
          ].map(([c, l]) => (
            <div key={l} className="text-center">
              <div className={cn("size-14 border border-rule-strong bg-surface", c)} />
              <p className="mt-1 font-mono text-2xs text-ink-3">{l}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="elevation" lede="Elevation is rare. Cards sit on the page with a hairline and a whisper of shadow; only things that float above content (popovers, the provenance panel) cast one.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["shadow-1", "1 · cards"],
            ["shadow-2", "2 · popovers"],
            ["shadow-panel", "panel · side sheet"],
          ].map(([c, l]) => (
            <div key={l} className={cn("grid h-20 place-items-center rounded-md border border-rule bg-surface", c)}>
              <span className="font-mono text-xs text-ink-2">{l}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="motion" lede="Motion explains change: a status advancing, a value updating, a panel arriving from where it was summoned. Five durations, two curves. With reduced motion, durations collapse to zero and movement becomes a fade.">
        <div className="space-y-2.5">
          {(
            [
              ["fast · 140ms · standard", duration.fast, ease.standard],
              ["base · 220ms · standard", duration.base, ease.standard],
              ["slow · 360ms · standard", duration.slow, ease.standard],
              ["chart · 650ms · standard", duration.chart, ease.standard],
              ["base · 220ms · emphasized", duration.base, ease.emphasized],
            ] as const
          ).map(([l, d, e]) => (
            <div key={l} className="grid grid-cols-[12rem_1fr] items-center gap-3">
              <span className="font-mono text-2xs text-ink-3">{l}</span>
              <div className="relative h-6 rounded-sm bg-sunk">
                <motion.div key={tick} className="absolute top-1 size-4 rounded-xs bg-ink" initial={{ left: "0.25rem" }} animate={{ left: reduce ? "0.25rem" : "calc(100% - 1.25rem)" }} transition={{ duration: d, ease: [...e] }} />
              </div>
            </div>
          ))}
          <Button size="sm" onClick={() => setTick((t) => t + 1)}>
            <PlayIcon size={14} /> Replay
          </Button>
        </div>
      </Section>
    </>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

// Final and in-progress labels exactly as streamed by the recorded run.
const RAIL: { name: string; label: string; running: string; detail?: string; model?: string }[] = [
  { name: "Intent", label: "Found support tickets and organizations", running: "Reading the schema", model: "claude-haiku-5-5" },
  { name: "Plan", label: "Planned support ticket spike dashboard", running: "Planning metrics and assumptions", detail: "Defining “Min tickets”", model: "claude-sonnet-5-5" },
  { name: "SQL", label: "Wrote 4 queries", running: "Writing SQL", detail: "3 of 4 written", model: "claude-sonnet-5-5" },
  { name: "Review", label: "Reviewed 4 queries: 2 flagged", running: "Reviewing queries", detail: "3 of 4 reviewed, 1 flagged", model: "claude-opus-5-5" },
  { name: "Execute", label: "Ran 4 queries in 360 ms", running: "Running queries read-only" },
];

function RailDemo() {
  const [step, setStep] = useState(5);
  const status = (i: number): StepStatus => (i < step ? (i === 3 ? "warn" : "done") : i === step ? "running" : "pending");
  const play = () => {
    setStep(0);
    [1, 2, 3, 4, 5].forEach((s, k) => setTimeout(() => setStep(s), (k + 1) * 900));
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Specimen label="Rail · interactive">
        <ol>
          {RAIL.map((r, i) => (
            <AgentStep key={r.name} index={i + 1} name={r.name} status={status(i)} label={i < step ? r.label : i === step ? r.running : undefined} detail={r.detail} model={i <= step ? r.model : undefined} last={i === RAIL.length - 1} />
          ))}
        </ol>
        <Button size="sm" className="mt-4" onClick={play}>
          <PlayIcon size={14} /> Replay run
        </Button>
      </Specimen>
      <Specimen label="Every status">
        <ol>
          {(["pending", "running", "done", "warn", "error", "skipped"] as StepStatus[]).map((s, i, a) => (
            <AgentStep key={s} index={i + 1} name={s} status={s} label={{ pending: undefined, running: "Reviewing queries", done: "Found subscriptions and events", warn: "Reviewed 3 queries: 1 flagged", error: "The model is rate limited right now.", skipped: "Skipped: question not answerable" }[s]} detail={s === "running" ? "Checking whether the join to subscriptions duplicates orgs with plan changes." : undefined} last={i === a.length - 1} />
          ))}
        </ol>
      </Specimen>
    </div>
  );
}

const CHIPS: Assumption[] = [
  { key: "active_window_days", label: "Active window", type: "int", value: 30, min: 1, max: 365, unit: "days", rationale: "A user counts as active if they had any event in this many days." },
  { key: "exclude_test_accounts", label: "Exclude test orgs", type: "bool", value: true, rationale: "The data dictionary says QA, demo and load-test tenants should be excluded." },
  { key: "churn_definition", label: "Churn", type: "enum", value: "cancel_reason_churn", options: ["cancel_reason_churn", "any_cancellation", "no_active_subscription"], rationale: "Plan changes close subscription rows, so only cancel_reason = churn counts." },
  { key: "timezone", label: "Timezone", type: "timezone", value: "UTC", rationale: "Days and weeks are bucketed in one timezone so counts are consistent." },
  { key: "date_range", label: "Period", type: "date_range", value: { preset: "this_quarter" }, rationale: "You asked about this quarter." },
];

function ChipDemo() {
  const [values, setValues] = useState(CHIPS);
  return (
    <div className="space-y-5">
      <Specimen label="Interactive · edit a value, then undo">
        <div className="flex flex-wrap gap-2">
          {values.map((a, i) => (
            <AssumptionChip key={a.key} assumption={a} original={CHIPS[i]} affects={i + 1} onChange={(n) => setValues((v) => v.map((x, j) => (j === i ? n : x)))} onUndo={() => setValues((v) => v.map((x, j) => (j === i ? CHIPS[i]! : x)))} />
          ))}
        </div>
      </Specimen>
      <div className="grid gap-4 sm:grid-cols-3">
        <Specimen label="Changed">
          <AssumptionChip assumption={{ ...CHIPS[0]!, value: 7 } as Assumption} original={CHIPS[0]} onChange={() => {}} onUndo={() => {}} affects={2} />
        </Specimen>
        <Specimen label="Changed · re-running">
          <AssumptionChip assumption={{ ...CHIPS[0]!, value: 7 } as Assumption} original={CHIPS[0]} onChange={() => {}} onUndo={() => {}} busy affects={2} />
        </Specimen>
        <Specimen label="Unused by any query">
          <AssumptionChip assumption={{ key: "include_trials", label: "Count trials", type: "bool", value: false, rationale: "Trialing accounts aren't paying yet." }} unused onChange={() => {}} />
        </Specimen>
      </div>
    </div>
  );
}

const phases: MetricView["phase"][] = ["writing", "reviewing", "running"];

function FrameDemo({ onOpen }: { onOpen: (v: MetricView, n: number) => void }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const empty: MetricView = { ...fixtures.bar, review: { ...fixtures.bar.review!, verdict: "pass", issues: [], rewritten_sql: null }, result: { ...fixtures.bar.result!, rows: [], row_count: 0 } };
  const blocked: MetricView = {
    ...fixtures.kpiShare,
    phase: "blocked",
    result: undefined,
    review: { ...fixtures.kpiShare.review!, verdict: "block", summary: "Counts plan changes as churn: cancel_reason includes upgrades, so churn is overstated about 2×.", issues: [{ code: "question_mismatch", severity: "block", message: "Filter subscriptions on cancel_reason = 'churn'; upgrade and downgrade rows are plan changes." }], rewritten_sql: null },
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label="Line · reviewer warning with fix" pad={false}>
          <ChartFrame view={fixtures.line} footnote={2} onOpenProvenance={() => onOpen(fixtures.line, 2)} className="border-0 shadow-none" />
        </Specimen>
        <Specimen label="Bar · reviewer warning with fix" pad={false}>
          <ChartFrame view={fixtures.bar} footnote={3} onOpenProvenance={() => onOpen(fixtures.bar, 3)} className="border-0 shadow-none" />
        </Specimen>
        <Specimen label="Table · pass" pad={false}>
          <ChartFrame view={fixtures.table} footnote={4} onOpenProvenance={() => onOpen(fixtures.table, 4)} className="border-0 shadow-none" />
        </Specimen>
        <Specimen label="Loading · cycles through the agent's phases" pad={false}>
          <ChartFrame view={{ ...fixtures.line, phase: phases[phaseIdx % 3]!, review: phaseIdx % 3 === 2 ? fixtures.line.review : undefined, result: undefined }} footnote={2} className="border-0 shadow-none" />
          <div className="border-t border-dashed border-rule-strong p-2">
            <Button size="sm" variant="ghost" onClick={() => setPhaseIdx((p) => p + 1)}>
              Next phase
            </Button>
          </div>
        </Specimen>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Specimen label="Blocked by reviewer (illustrative)" pad={false}>
          <ChartFrame view={blocked} footnote={5} onOpenProvenance={() => onOpen(blocked, 5)} className="border-0 shadow-none" />
        </Specimen>
        <Specimen label="Failed (real run)" pad={false}>
          <ChartFrame view={fixtures.failed} footnote={6} onRetry={() => {}} className="border-0 shadow-none" />
        </Specimen>
        <Specimen label="Empty result" pad={false}>
          <ChartFrame view={empty} footnote={7} className="border-0 shadow-none" />
        </Specimen>
      </div>
      <Specimen label="Re-running after an assumption change" pad={false} className="lg:max-w-[50%]">
        <ChartFrame view={{ ...fixtures.kpi, phase: "rerunning" }} footnote={1} className="border-0 shadow-none" />
      </Specimen>
    </div>
  );
}

const DICT: DictionaryRowData[] = [
  { table: "users", column: "is_internal", type: "boolean", description: "True for Northwind Cloud staff added to customer workspaces for support. Exclude from customer metrics.", status: "proposed", source: "agent" },
  { table: "invoices", column: "amount_cents", type: "integer", description: "Invoice amount in cents.", status: "accepted", source: "starter" },
  { table: "subscriptions", column: "plan_id", type: "smallint NULL", description: "The plan this subscription is on.", status: "rejected", source: "agent" },
];

function DictionaryDemo() {
  const [rows, setRows] = useState(DICT);
  const set = (i: number, patch: Partial<DictionaryRowData>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Specimen label="Proposed · accepted · rejected (interactive)" pad={false}>
      <div className="rounded-md bg-surface">
        {rows.map((r, i) => (
          <DictionaryRow key={r.column} row={r} onAccept={() => set(i, { status: "accepted" })} onReject={() => set(i, { status: "rejected" })} onRestore={() => set(i, { status: "proposed" })} onSave={(d) => set(i, { description: d, status: "accepted", source: "you" })} />
        ))}
      </div>
    </Specimen>
  );
}

export function SystemShowcase() {
  const [panel, setPanel] = useState<{ view: MetricView; n: number } | null>(null);
  const kpiRow = fixtures.kpi.result!.rows[0]!;
  const shareRow = fixtures.kpiShare.result!.rows[0]!;

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[11rem_1fr] lg:gap-12">
      <nav aria-label="Design system sections" className="hidden lg:block">
        <div className="sticky top-24 space-y-5 text-sm">
          {SECTIONS.map(([id, title, items]) => (
            <div key={id}>
              <p className="eyebrow mb-1.5">{title}</p>
              <ul className="space-y-0.5">
                {items.map((s) => (
                  <li key={s}>
                    <a href={`#${s}`} className="block rounded-sm py-0.5 text-ink-2 hover:text-ink">
                      {TITLES[s]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        <header className="mb-10 max-w-3xl">
          <p className="eyebrow">Design system</p>
          <h1 className="mt-2 display text-4xl text-ink">A design system for an agent that shows its work</h1>
          <p className="mt-3 text-lg text-ink-2">
            Glassbox's interface borrows from the audit trail: hairline rules, footnoted numbers, monospace provenance. Every component here exists to make an AI agent's reasoning legible and checkable. Specimens use real output recorded from the agent, not mock data.
          </p>
          <p className="mt-2 font-mono text-2xs text-ink-3">{fixtureSource}</p>
        </header>

        <h2 id="foundations" className="eyebrow mb-6 scroll-mt-20">
          Foundations
        </h2>
        <Foundations />

        <h2 id="components" className="eyebrow mt-6 mb-6 scroll-mt-20 border-t border-rule pt-10">
          Components
        </h2>

        <Section id="askbar" lede="Where a question starts. Suggested questions remove the blank-page problem for first-time visitors. Press / anywhere to focus it." props={[["onAsk", "(q: string) => void", "Called with the trimmed question (3–300 chars)"], ["suggestions", "string[]", "Shown as one-click chips"], ["running", "boolean", "Swaps Ask for Stop"], ["trailing", "ReactNode", "Slot for the Cached/Live toggle"]]}>
          <div className="space-y-4">
            <Specimen label="Default with suggestions">
              <AskBar id="ask-demo-1" label="Example: default ask bar" onAsk={() => {}} suggestions={["How's retention this quarter?", "Where are support tickets spiking?"]} />
            </Specimen>
            <div className="grid gap-4 md:grid-cols-2">
              <Specimen label="Running">
                <AskBar id="ask-demo-2" label="Example: running" onAsk={() => {}} running onCancel={() => {}} defaultValue="Who are our most engaged organizations?" />
              </Specimen>
              <Specimen label="Disabled (rate limited)">
                <AskBar id="ask-demo-3" label="Example: disabled" onAsk={() => {}} disabled defaultValue="Which plans drive the most revenue growth?" />
              </Specimen>
            </div>
          </div>
        </Section>

        <Section id="agentstep" lede="One step of the agent's work, from pending to running to done. Labels are short and human ('Found subscriptions and events'); while a step runs, a detail line shows a summary of what the model is reasoning about right now." props={[["status", "pending | running | done | warn | error | skipped", "Icon + screen-reader text per status"], ["label", "string", "Cross-fades when it changes"], ["detail", "string", "Live progress, shown only while running"], ["model", "string", "Which model did the work"]]}>
          <RailDemo />
        </Section>

        <Section id="assumptionchip" lede="Every judgment call the agent made, as a typed, editable value. Editing one re-runs only the queries that bind it, with no model calls. Changed values turn amber and keep the agent's original for undo; a dashed chip means no query actually uses it." props={[["assumption", "Assumption", "int | bool | enum | timezone | date_range"], ["original", "Assumption", "The agent's value; differing values show as changed"], ["onChange / onUndo", "fn", "Edit and revert"], ["affects", "number", "How many queries re-run"], ["unused", "boolean", "No query binds this parameter"]]}>
          <ChipDemo />
        </Section>

        <Section id="metriccard" lede="A headline number in the interface sans at hero size. The change vs. the comparison period stays neutral: the agent can't know whether up is good for an arbitrary metric, so it doesn't claim to with color." props={[["value / previous", "Cell", "Previous enables the delta line"], ["unit", "count | percent | usd | hours | ratio", "Formatting"], ["trend", "number[]", "Optional sparkline"]]}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Specimen label="Count with delta (real)">
              <MetricCard label="Support tickets" value={kpiRow[0]} previous={kpiRow[1]} />
            </Specimen>
            <Specimen label="Percent, delta in points (real)">
              <MetricCard label="Share of orgs highly engaged" unit="percent" value={shareRow[0]} previous={shareRow[1]} />
            </Specimen>
            <Specimen label="With sparkline">
              <MetricCard label="Weekly tickets" size="md" value={fixtures.line.result!.rows.at(-2)![1]} trend={fixtures.line.result!.rows.slice(0, -1).map((r) => Number(r[1]))} comparisonLabel="last full week" />
            </Specimen>
          </div>
        </Section>

        <Section id="chartframe" lede="The frame every metric renders in. It owns the metric's whole lifecycle: a skeleton that names what the agent is doing, the chart, the reviewer's warning inline with a before/after diff, blocked and failed states, and a footer with rows, runtime and the parameters used. The footnote number ties the chart to its provenance." props={[["view", "MetricView", "Metric, phase, SQL, review, result"], ["footnote", "number", "[n] reference into provenance"], ["selected", "boolean", "J/K focus ring"], ["onOpenProvenance", "() => void", "Opens the side panel"]]}>
          <FrameDemo onOpen={(view, n) => setPanel({ view, n })} />
        </Section>

        <Section id="sqlblock" lede="SQL with line numbers and restrained highlighting. Parameters are tinted in the assumption accent, so you can see exactly which values a chip controls. The diff view shows a reviewer's rewrite line by line." props={[["sql", "string", ""], ["title", "ReactNode", "Caption, e.g. 'Executed as glassbox_reader'"], ["maxHeight", "number", "Scrolls beyond"]]}>
          <div className="grid gap-4 xl:grid-cols-2">
            <SQLBlock sql={fixtures.table.finalSql ?? fixtures.table.sql!} title="Executed as glassbox_reader" maxHeight={320} />
            <SqlDiff before={fixtures.line.sql!} after={fixtures.line.review!.rewritten_sql!} />
          </div>
        </Section>

        <Section id="provenancepanel" lede="Where a number came from: the reviewer's verdict, the exact SQL that ran (and the agent's draft, if the reviewer rewrote it), bound parameter values, paginated rows, runtime, planner cost and timestamp. Esc closes; focus returns to where you were." props={[["view", "MetricView | null", "null closes"], ["footnote", "number", ""], ["reviewerModel", "string", ""]]}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPanel({ view: fixtures.line, n: 2 })}>Open: reviewer rewrote the query</Button>
            <Button onClick={() => setPanel({ view: fixtures.table, n: 4 })}>Open: clean pass</Button>
          </div>
        </Section>

        <Section id="reviewerbadge" lede="The second agent's verdict on a query. Each verdict has its own icon and label, so color never carries the meaning alone.">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewerBadge verdict="pass" />
            <ReviewerBadge verdict="warn" />
            <ReviewerBadge verdict="warn" rewritten />
            <ReviewerBadge verdict="block" />
            <ReviewerBadge verdict="reviewing" />
            <ReviewerBadge verdict="pending" />
            <ReviewerBadge verdict="pass" size="md" />
            <ReviewerBadge verdict="block" size="md" />
          </div>
        </Section>

        <Section id="dictionaryrow" lede="One table or column in the Data Dictionary. The agent proposes plain-English descriptions; you accept, edit or reject them, and only accepted entries become part of the agent's context." props={[["row", "DictionaryRowData", "table, column, type, description, status, source"], ["onAccept / onReject / onSave / onRestore", "fn", ""]]}>
          <DictionaryDemo />
        </Section>

        <Section id="skeleton" lede="Placeholders shaped like what's coming, so nothing jumps when it resolves. The shimmer only runs when motion is allowed.">
          <div className="grid gap-4 md:grid-cols-4">
            <Specimen label="Text">
              <SkeletonText lines={4} />
            </Specimen>
            <Specimen label="Line chart">
              <SkeletonChart kind="line" height={120} />
            </Specimen>
            <Specimen label="Bar chart">
              <SkeletonChart kind="bar" height={120} />
            </Specimen>
            <Specimen label="Table">
              <SkeletonChart kind="table" height={120} />
            </Specimen>
          </div>
          <Specimen label="KPI" className="mt-4 max-w-xs">
            <div className="space-y-2">
              <Skeleton className="h-11 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </Specimen>
        </Section>

        <Section id="emptystate" lede="Nothing to show yet: say why, and what to do next.">
          <div className="grid gap-4 md:grid-cols-2">
            <Specimen label="Before the first question">
              <EmptyState icon={<DatabaseIcon />} title="Ask a question to build a dashboard" action={<Button size="sm">Try “How's retention this quarter?”</Button>}>
                The agent reads the schema, states its assumptions and shows every query it runs.
              </EmptyState>
            </Specimen>
            <Specimen label="Compact, inside a chart">
              <EmptyState compact icon={<TableIcon />} title="No rows for these assumptions">
                Try a wider date range or relax a filter above.
              </EmptyState>
            </Specimen>
          </div>
        </Section>

        <Section id="errorstate" lede="Something failed. Say what, in plain words, keep the raw error available for developers, and offer the one useful next action. Partial failure is its own tone: the rest of the dashboard still stands.">
          <div className="grid gap-4 md:grid-cols-2">
            <Specimen label="Block">
              <ErrorState title="The query failed to run" detail="canceling statement due to statement timeout" onRetry={() => {}}>
                It hit the 5-second limit. Narrowing the date range usually helps.
              </ErrorState>
            </Specimen>
            <div className="space-y-4">
              <Specimen label="Inline">
                <ErrorState layout="inline" title="Couldn't reach the model" onRetry={() => {}}>
                  Showing the cached run instead.
                </ErrorState>
              </Specimen>
              <Specimen label="Inline · partial">
                <ErrorState layout="inline" tone="partial" title="3 of 4 metrics ran">
                  The reviewer blocked one query; the others are unaffected.
                </ErrorState>
              </Specimen>
              <Specimen label="Keyboard">
                <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <Kbd>/</Kbd> ask <Kbd>J</Kbd>
                  <Kbd>K</Kbd> move between charts <Kbd>Enter</Kbd> provenance <Kbd>Esc</Kbd> close
                </p>
              </Specimen>
            </div>
          </div>
        </Section>

        <section className="border-t border-rule py-10">
          <p className="eyebrow mb-2">Data table (used inside ChartFrame and ProvenancePanel)</p>
          <DataTable result={fixtures.table.result!} pageSize={4} caption="Data table specimen: ticket change by category" />
        </section>
      </div>

      <ProvenancePanel view={panel?.view ?? null} footnote={panel?.n} reviewerModel="claude-opus-5-5" onClose={() => setPanel(null)} />
    </main>
  );
}
