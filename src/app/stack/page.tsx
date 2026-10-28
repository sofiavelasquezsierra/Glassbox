import type { Metadata } from "next";
import Link from "next/link";
import { Article, Callout, H2, H3, Kicker, List, P, Title } from "@/components/content/Prose";
import { CheckIcon, CloseIcon } from "@/components/system/icons";
import evalResults from "@/data/eval-results.json";
import { cn } from "@/lib/cn";
import { recordedRunStats } from "@/lib/run-stats";
import type { StepId } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "AI stack",
  description: "How I'd build the AI stack for an analytics agent: model routing, grounding, a semantic layer, SQL safety, evaluation, streaming, cost control and observability.",
};

const fmt = (v: unknown, unit?: string) => {
  if (v === null || v === undefined) return "no answer";
  if (typeof v === "number") return unit === "usd" ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : unit === "percent" ? `${v}%` : v.toLocaleString("en-US");
  return String(v);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

export default function StackPage() {
  const stats = recordedRunStats();
  const ev = evalResults;
  const stepMedian = (id: StepId) => median(stats.runs.map((r) => (r.steps[id] ? r.steps[id]!.end - r.steps[id]!.start : 0)));
  const ranAt = new Date(ev.ran_at);

  return (
    <Article>
      <Kicker>Technical deep-dive</Kicker>
      <Title lede="What I'd put behind an AI agent that turns a Supabase database into dashboards, and what I learned building a small version of it.">How I&apos;d build the AI stack for an analytics agent</Title>
      <Callout label="Scope">
        These are my recommendations, illustrated with what I built for <Link href="/">Glassbox</Link>. They are not claims about how Dreambase works today. Every number on this page comes from this prototype&apos;s own runs and is rendered from its data files at build time.
      </Callout>

      <H2 id="routing" n="01">
        Route models by the cost of being wrong
      </H2>
      <P>
        Not every step deserves the same model. Classifying a question is cheap to get slightly wrong and easy to recover from; a SQL bug that ships a wrong number is expensive. So route by consequence, not by habit:
      </P>
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="eyebrow">
            <tr className="border-b border-rule">
              <th className="py-2 pr-3 font-normal">Step</th>
              <th className="py-2 pr-3 font-normal">Model · effort</th>
              <th className="py-2 pr-3 font-normal">Why</th>
              <th className="py-2 text-right font-normal">Median</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {(
              [
                ["intent", "Haiku 5.5 · low", "Picks tables and checks answerability. Fast and cheap; mistakes get caught downstream."],
                ["plan", "Sonnet 5.5 · medium", "Chooses metrics and, crucially, makes every definition an explicit assumption."],
                ["sql", "Sonnet 5.5 · medium", "One call per metric, in parallel, so charts arrive as they're ready."],
                ["review", "Opus 5.5 · medium", "The strongest model on the step where errors are costliest, with a different prompt and a different job."],
              ] as [StepId, string, string][]
            ).map(([id, m, why]) => (
              <tr key={id} className="border-b border-rule">
                <td className="py-2 pr-3 font-mono text-ink">{id}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-ink">{m}</td>
                <td className="py-2 pr-3">{why}</td>
                <td className="py-2 text-right font-mono whitespace-nowrap text-ink tabular">{(stepMedian(id) / 1000).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-3">
          Median wall time per step across the {stats.runs.length} recorded runs. SQL and review overlap because metrics run concurrently. Full runs took {(stats.minMs / 1000).toFixed(0)}–{(stats.maxMs / 1000).toFixed(0)}s and cost ${stats.minCost.toFixed(2)}–${stats.maxCost.toFixed(2)}.
        </p>
      </div>
      <P>
        Every call uses structured output with a Zod schema, then validates again strictly on the server. A failed validation (wrong shape, an unknown parameter, a query that fails the SQL validator, an assumption the query never uses) gets exactly one repair turn with the specific errors, then surfaces as a visible error. Server-side refusal fallback is enabled on the Sonnet and Opus calls.
      </P>

      <H2 id="grounding" n="02">
        Ground the agent in structure, then in meaning
      </H2>
      <P>
        The agent sees what <code>information_schema</code> would show (tables, columns, types, nullability, keys) and nothing about meaning. Meaning comes from a <Link href="/dictionary">Data Dictionary</Link> the user curates. The agent bootstraps it by profiling every column (null share, common values, ranges, negative counts) and proposing descriptions; only accepted entries go into context, inside a delimited block that the prompt treats as documentation, never instructions.
      </P>
      <P>
        Profiling is what makes the proposals useful. Without being told, the agent noted that 19 invoice rows are negative (&ldquo;likely credits or refunds&rdquo;), that <code>cancel_reason</code> mixes churn with plan changes, and that <code>plan_id</code> is sometimes NULL and needs a left join. In a product, I&apos;d also profile join cardinality (which keys are one-to-many) because fan-out is the most common silent error.
      </P>

      <H2 id="semantic" n="03">
        Add a semantic layer once definitions stabilize
      </H2>
      <P>
        Glassbox re-derives each definition per question, then lets the user edit it. That&apos;s right for a first answer and wrong for the hundredth. The next step is a semantic layer: accepted definitions (&ldquo;active user = any event in 30 days, excluding internal users&rdquo;) become named, versioned metrics with SQL the agent composes instead of rewriting. That gives consistency across dashboards, a smaller surface for the reviewer, and a place for humans to own the definitions that matter. I didn&apos;t build this; the assumption chips are the seed of it.
      </P>

      <H2 id="safety" n="04">
        Make SQL safety structural, not promptable
      </H2>
      <P>Prompts can&apos;t be a security boundary. Glassbox layers controls so that any one of them failing still leaves the others:</P>
      <List>
        <li>
          <strong>Parse, don&apos;t pattern-match.</strong> Queries go through libpg_query, the real Postgres parser compiled to WASM: exactly one statement, a SELECT at the top, no data-modifying CTEs, no <code>SELECT INTO</code> or row locks, functions from an allowlist, tables only from the demo schema. It fails closed.
        </li>
        <li>
          <strong>Parameters, never interpolation.</strong> The agent writes <code>:named</code> placeholders that are compiled to bound parameters. Dates resolve on the server against a fixed clock; <code>now()</code> is rejected so results are reproducible.
        </li>
        <li>
          <strong>EXPLAIN before running.</strong> Plans over a cost ceiling are rejected before they touch data.
        </li>
        <li>
          <strong>A role that can&apos;t do harm.</strong> Execution runs as a Postgres role with SELECT on one schema only, inside a READ ONLY transaction, with a 5-second statement timeout and a 1,000-row cap. A verification script attempts writes, escalation and reads of other schemas as that role; all 24 checks are refused.
        </li>
        <li>
          <strong>Sign what the server generated.</strong> Edits re-run SQL with new parameters; the server HMAC-signs every query it produces, so the re-run endpoint can&apos;t be used to execute arbitrary SQL.
        </li>
      </List>

      <H2 id="eval" n="05">
        Evaluate against a golden set with known answers
      </H2>
      <P>
        Ten questions a founder would ask, each with hand-written ground-truth SQL over the deterministic seed, and each aimed at a specific trap (test accounts, plan changes stored as cancellations, refunds as negative rows, legacy plan rows, timezone boundaries). The script runs the live agent on every question and grades its headline answer: numbers within a stated tolerance, labels by name. Ground truth is never edited to match agent output, and every full run is kept.
      </P>
      <div className="my-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-rule text-center">
        {[
          [`${ev.summary.passed}/${ev.summary.total}`, "passed, latest run"],
          [`$${ev.summary.cost_usd.toFixed(2)}`, "cost of the run"],
          [`${(ev.summary.median_latency_ms / 1000).toFixed(0)}s`, "median per question"],
        ].map(([v, l]) => (
          <div key={l} className="bg-surface px-3 py-4">
            <p className="text-2xl font-semibold tracking-tight text-ink">{v}</p>
            <p className="mt-0.5 text-xs text-ink-3">{l}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-rule bg-surface lg:-mx-32" tabIndex={0} role="region" aria-label="Golden-set results">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-sunk font-mono text-2xs text-ink-3">
            <tr>
              <th className="px-3 py-2 font-medium">Question</th>
              <th className="px-3 py-2 text-right font-medium">Expected</th>
              <th className="px-3 py-2 text-right font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {ev.results.map((r) => (
              <tr key={r.id} className="border-t border-rule align-top">
                <td className="min-w-[16rem] px-3 py-2">
                  <p className="text-ink">{r.question}</p>
                  <p className="mt-0.5 text-ink-3">Trap: {r.trap}</p>
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-ink tabular">{fmt(r.expected, r.unit)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-ink tabular">{fmt(r.got, r.unit)}</td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center gap-1 font-medium", r.pass ? "text-pass" : "text-block")}>
                    {r.pass ? <CheckIcon size={13} /> : <CloseIcon size={13} />}
                    {r.pass ? "Pass" : "Fail"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {r.reviewer.map((v, i) => (
                      <span key={i} className={cn("rounded-xs px-1 font-mono text-2xs", v.verdict === "pass" ? "bg-pass-wash text-pass" : v.verdict === "warn" ? "bg-warn-wash text-warn" : "bg-block-wash text-block")}>
                        {v.verdict}
                        {v.rewrote ? "+fix" : ""}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3 lg:-mx-32">
        Latest run {ranAt.toISOString().slice(0, 10)} · models: {Object.values(ev.models).join(", ")} · dictionary: {ev.dictionary}. Reviewer column: one verdict per metric in that run. Run history: {ev.history.map((h) => `${h.passed}/${h.total}${h.note ? ` (${h.note})` : ""}`).join(" → ")}.
      </p>
      <H3>What the failures were</H3>
      <P>
        I read every failing trace. In the latest run, all three failures were defensible alternative definitions, each exposed to the user as an editable assumption: revenue bucketed by payment date instead of invoice date; &ldquo;active in the last 30 days&rdquo; measured over 30 <em>complete</em> days (the reviewer&apos;s rewrite) rather than the system&apos;s documented convention; and &ldquo;paying&rdquo; meaning active-only rather than active or past due. The eval is strict about my definitions on purpose. A product version should score these separately from real errors, perhaps by checking whether any setting of the exposed assumptions reaches the right answer.
      </P>
      <P>
        Runs also vary: two questions that passed in one run failed in the next. A single pass rate hides that, so the history is kept and I&apos;d report pass@k across repeated runs in a real pipeline. The first run also caught a bug in my own parameter code (custom date ranges were off by a day), flagged by the reviewer on every affected query.
      </P>

      <H2 id="streaming" n="06">
        Stream the work so waiting feels like watching
      </H2>
      <P>
        A run takes {(stats.minMs / 1000).toFixed(0)}–{(stats.maxMs / 1000).toFixed(0)} seconds. That&apos;s acceptable if the user can see why. Every model call streams; the server turns progress into typed events over SSE (step status, plan, SQL, review, result, errors), and the client reduces them into state. Summarized thinking supplies the one-line &ldquo;what it&apos;s doing now&rdquo; detail. Fanning SQL, review and execution out per metric took the four-metric retention question from 87s to 51s, and charts now resolve one by one rather than all at the end.
      </P>

      <H2 id="cost" n="07">
        Control cost structurally
      </H2>
      <List>
        <li>
          <strong>Prompt caching.</strong> System prompts are static per role (schema, rules, conventions), so they cache; per-request material goes in the user turn. Across the recorded runs, {(stats.cacheShare * 100).toFixed(0)}% of input tokens were cache reads.
        </li>
        <li>
          <strong>Don&apos;t call a model when you don&apos;t need one.</strong> Editing an assumption re-executes signed SQL with new parameters. It&apos;s instant and costs nothing in tokens.
        </li>
        <li>
          <strong>Recorded runs for first impressions.</strong> First-time visitors watch a real recorded trace for free; live runs are opt-in.
        </li>
        <li>
          <strong>Hard caps.</strong> Per-step output-token limits, at most four metrics, a 110-second run ceiling, per-visitor and daily rate limits, and fallback to a recorded run on limits or errors.
        </li>
      </List>

      <H2 id="observability" n="08">
        Observe runs like you&apos;d observe a service
      </H2>
      <P>
        Glassbox records per-run token usage and cost, per-step timing, reviewer verdicts and every eval run, which is enough for a prototype. In production I&apos;d add:
      </P>
      <List>
        <li>A trace per run (one span per step and per metric chain) with model, effort, tokens, cache reads, repair turns and the validator&apos;s rejections.</li>
        <li>Reviewer outcomes as a metric: flag rate, rewrite rate and block rate by issue code. A spike in <code>join_fanout</code> after a prompt change is a regression signal.</li>
        <li>The golden set in CI on every prompt or model change, with pass@k and cost per question, plus a sample of production questions promoted into the set when users edit an assumption (an edit is a label).</li>
        <li>User-side signals: which assumptions get edited, which provenance panels get opened, which charts get abandoned. Those are where trust is being lost.</li>
      </List>
    </Article>
  );
}
