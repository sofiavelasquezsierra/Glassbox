import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/content/ArchitectureDiagram";
import { Article, Callout, Figure, H2, H3, Kicker, List, P, Title, Todo } from "@/components/content/Prose";
import evalResults from "@/data/eval-results.json";
import { recordedRunStats } from "@/lib/run-stats";

export const metadata: Metadata = {
  title: "Case study",
  description: "Designing an AI analytics agent a developer without a data team can trust: principles, rejected directions, interaction decisions and architecture.",
};

export default function CaseStudy() {
  const stats = recordedRunStats();
  const e = evalResults.summary;
  return (
    <Article serif>
      <Kicker>Case study</Kicker>
      <Title lede="An AI analytics agent can produce a dashboard in thirty seconds. The hard part is making someone believe it. Glassbox is a working prototype of an agent that earns trust by showing its work.">
        Designing an analytics agent you can check
      </Title>

      <Todo>
        A short personal intro: who you are, why this problem, and why Dreambase. Two or three sentences in your own voice. Also set your name in <code>src/data/site.ts</code>.
      </Todo>

      <H2 id="problem" n="01">
        The trust problem
      </H2>
      <P>
        Tools that let an AI agent write SQL against your database have mostly solved generation. The output looks finished: a clean chart, a confident number. That is exactly the problem. A dashboard that is wrong looks identical to one that is right, and the ways an agent gets analytics wrong are invisible from the chart.
      </P>
      <P>
        Building Glassbox made this concrete. Each of these came from real agent output against the demo database, caught by the reviewer before it reached a chart:
      </P>
      <List>
        <li>
          <strong>Population.</strong> A &ldquo;paying customers&rdquo; filter used each subscription&apos;s <em>current</em> status, so accounts that were still trialing at the start of the period counted as paying.
        </li>
        <li>
          <strong>Definitions.</strong> A retention query treated organizations whose last subscription ended with no recorded reason as retained.
        </li>
        <li>
          <strong>Time.</strong> Partial first and last weeks drawn as dips in a trend; date boundaries that needed checking against the chosen timezone; and an off-by-one in a custom date range (that one was my bug, below).
        </li>
      </List>
      <P>
        The seeded data also contains traps the agent <em>avoided</em> in these runs: a synthetic load-test tenant that would top any engagement ranking, Northwind staff inside customer workspaces, and plan upgrades stored as cancellations. Some it avoided because the Data Dictionary documented them, which is the argument for making that context visible and editable.
      </P>
      <P>None of these produce an error. They produce a plausible number. A user who can&apos;t read the SQL has no way to know.</P>

      <H2 id="user" n="02">
        Who it&apos;s for
      </H2>
      <P>
        A founder or developer with a Supabase project and no data team. They know their product and can read SQL when they have to, but they don&apos;t have time to audit every query, and they don&apos;t have an analyst to ask &ldquo;is this right?&rdquo; They need answers fast and they need to be able to defend those answers to a co-founder or an investor.
      </P>
      <P>
        That combination sets the design brief: the agent has to be fast enough that people use it, and transparent enough that when it matters, they can check it without starting from scratch.
      </P>
      <Todo>
        If you spoke with founders or developers about how they use (or avoid) AI analytics, summarize what you heard here, or say plainly that this persona is an assumption. Don&apos;t include numbers or quotes you didn&apos;t collect.
      </Todo>

      <H2 id="principles" n="03">
        Design principles
      </H2>
      <H3>1. Every judgment call is a visible, editable value</H3>
      <P>
        An analyst&apos;s real work is choosing definitions: what counts as active, which period, which timezone, whether test accounts count. The agent must make those choices explicit as typed assumptions (a number with bounds, a yes/no, a date range) rather than burying them in prose or SQL. In the UI they&apos;re the amber chips above the dashboard, and changing one re-runs only the affected queries.
      </P>
      <H3>2. Nothing renders until a second agent has checked it</H3>
      <P>
        A separate Claude call, with a different prompt and a different job (find what&apos;s wrong), reviews every query for join fan-out, NULL handling, timezone boundaries, test-account leakage and mismatch with the question. It can pass, warn, rewrite or block. A blocked chart says so instead of showing a number the reviewer believes is wrong.
      </P>
      <H3>3. Every number has a footnote</H3>
      <P>
        Each chart carries a footnote marker, like a citation. Following it opens the exact SQL that ran, the reviewer&apos;s verdict, the bound parameter values, the rows that came back, and when and how fast it ran. Provenance isn&apos;t a debug mode; it&apos;s one click from every number.
      </P>
      <H3>4. Fail visibly and partially</H3>
      <P>
        If one metric fails, the others still stand and the failed one says what failed, in plain words, with the raw error available. A run that can&apos;t go live falls back to a recorded run and says so.
      </P>
      <H3>5. Exploring is cheap; asking is honest</H3>
      <P>
        Editing an assumption re-executes signed SQL with new parameters, with no model call, so exploration is instant and free. The trade-off is stated in the interface: the reviewer checked those queries with the agent&apos;s original values.
      </P>

      <H2 id="rejected" n="04">
        Directions I didn&apos;t take
      </H2>
      <Todo>These are the directions I reasoned about while building. Replace or extend them with the explorations from your own process, and add the Figma exports.</Todo>
      <H3>A chat transcript with charts inline</H3>
      <Figure alt="Exploration: conversational thread where each answer is a message containing a chart" caption="Rejected: the conversation becomes the record, and assumptions are buried in prose." />
      <P>
        Chat is the default shape for AI products, and it&apos;s good at follow-ups. But a transcript is a poor place to keep a dashboard: definitions get stated once in a paragraph and then scroll away, and changing one means asking again and hoping the agent changes only that. Glassbox keeps the conversation&apos;s output as a stable artifact with its assumptions pinned to the top.
      </P>
      <H3>A confidence score on every chart</H3>
      <Figure alt="Exploration: chart cards with a 0–100% confidence badge" caption="Rejected: a number about a number can't be checked." />
      <P>
        A &ldquo;92% confident&rdquo; badge looks like transparency but gives the user nothing to act on, and model self-reported confidence isn&apos;t calibrated. A reviewer verdict with a one-line reason (&ldquo;partial first week reads as a dip&rdquo;) is checkable and actionable.
      </P>
      <H3>SQL-first: a notebook the agent fills in</H3>
      <Figure alt="Exploration: notebook layout with editable SQL cells above each chart" caption="Rejected as the default: it hands the audit back to the person who has no time for it." />
      <P>
        Showing editable SQL first is honest, but it optimizes for the analyst this user doesn&apos;t have. Glassbox keeps SQL one click away, highlighted with the parameters that each chip controls, and leads with the decisions a non-specialist can actually evaluate.
      </P>

      <H2 id="decisions" n="05">
        Interaction decisions and trade-offs
      </H2>
      <H3>Stream the work, not just the answer</H3>
      <P>
        The activity rail shows each step moving from pending to running to done, with short human labels (&ldquo;Found subscriptions and events&rdquo;) and, while a step runs, a one-line summary of what the model is reasoning about. Metrics run as independent chains (SQL, then review, then execute), so charts resolve one at a time instead of all at the end. For the same four-metric retention question, making the chains parallel took a run from 87 seconds to 51.
      </P>
      <H3>Deltas without opinions</H3>
      <P>
        Headline numbers show change against the comparison period in neutral ink. The agent can&apos;t know whether &ldquo;up&rdquo; is good for an arbitrary metric, and coloring churn growth green would be worse than not coloring it at all.
      </P>
      <H3>The reviewer&apos;s rewrite is a diff, not a swap</H3>
      <P>
        When the reviewer fixes a query, the chart runs the fixed version and the warning offers &ldquo;See fix,&rdquo; a line diff of the agent&apos;s draft against the reviewer&apos;s rewrite. Silently swapping SQL would hide the most interesting thing that happened.
      </P>
      <H3>A Data Dictionary the user curates</H3>
      <P>
        The agent profiles every column (null rates, common values, ranges) and proposes descriptions; the user accepts, edits or rejects each one, and only accepted entries reach the agent. Profiling grounds the proposals in data: without being told, the agent noted that 19 invoice rows are negative (&ldquo;likely credits or refunds&rdquo;) and that plan changes share a column with churn. Each visitor curates their own copy, so one person&apos;s edits can&apos;t change another&apos;s agent.
      </P>
      <H3>A fixed &ldquo;today&rdquo;</H3>
      <P>
        Relative dates resolve against a pinned date (Oct 28, 2026) and the validator rejects <code>now()</code>. It looks odd in a demo, but it makes results reproducible, which is what makes the evaluation meaningful.
      </P>
      <Callout label="A real moment from the build">
        In the first evaluation run, two questions failed. The cause wasn&apos;t the SQL agent; it was me. My parameter code treated a custom date range&apos;s end as inclusive, the planner wrote it as exclusive, and quarters silently gained a day. The reviewer flagged it on every affected query (&ldquo;the resolved date range ends on 2026-10-02&rdquo;) and blocked the one where it changed the answer. The contract is now documented and tested.
      </Callout>

      <H2 id="architecture" n="06">
        Architecture
      </H2>
      <ArchitectureDiagram />
      <P>
        The full reasoning, including model routing, SQL safety and evaluation, is on the <Link href="/stack">AI stack</Link> page. The short version: every model output is streamed and validated against a schema, queries go through a real Postgres parser and an EXPLAIN cost check before running as a role that can only read the demo schema, and edits re-run SQL the server signed, so the re-run endpoint can&apos;t be used to run arbitrary queries.
      </P>

      <H2 id="real" n="07">
        What&apos;s real and what isn&apos;t
      </H2>
      <div className="my-6 overflow-x-auto font-sans text-sm">
        <table className="w-full border-collapse text-left">
          <thead className="eyebrow">
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 font-normal">Real</th>
              <th className="py-2 font-normal">Not real</th>
            </tr>
          </thead>
          <tbody className="align-top text-ink-2">
            <tr className="border-b border-rule">
              <td className="py-2 pr-4">Claude calls for intent, plan, SQL, review and dictionary proposals</td>
              <td className="py-2">Northwind Cloud, its customers and all its data (generated from a fixed seed)</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="py-2 pr-4">A Supabase Postgres database, queried read-only on every run and every edit</td>
              <td className="py-2">&ldquo;Today&rdquo; (pinned to Oct 28, 2026)</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="py-2 pr-4">
                Recorded runs: actual agent traces ({stats.runs.length} questions), replayed with compressed waiting time
              </td>
              <td className="py-2">Per-step timings during a replay (hidden for that reason; the original duration is shown)</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="py-2 pr-4">
                The golden-set evaluation ({e.passed}/{e.total} on the latest run) and its history
              </td>
              <td className="py-2">User research: none was conducted for this prototype</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Rate limits, read-only role, SQL validation, signed re-runs</td>
              <td className="py-2">Authentication or multi-tenant isolation (there&apos;s one shared demo database)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>
        Across the {stats.runs.length} recorded runs, the reviewer checked {stats.queries} queries, flagged {stats.flagged} and rewrote {stats.rewritten}. Runs took {(stats.minMs / 1000).toFixed(0)}–{(stats.maxMs / 1000).toFixed(0)} seconds and cost ${stats.minCost.toFixed(2)}–${stats.maxCost.toFixed(2)} each.
      </P>

      <H2 id="next" n="08">
        What I&apos;d build next
      </H2>
      <List>
        <li>
          <strong>A semantic layer.</strong> Accepted definitions (&ldquo;active = any event in 30 days, excluding internal users&rdquo;) should become reusable metrics the agent composes, rather than being re-derived in every query.
        </li>
        <li>
          <strong>Re-review on edit.</strong> Today an edited assumption re-runs reviewed SQL; a cheap, targeted re-review when an edit crosses a meaningful boundary (e.g. a timezone change) would close that gap.
        </li>
        <li>
          <strong>Disagreement as a feature.</strong> Most evaluation failures were defensible alternative definitions. Surfacing &ldquo;two reasonable answers&rdquo; with the assumption that separates them is more honest than picking one.
        </li>
        <li>
          <strong>Follow-up questions</strong> that edit the existing dashboard (&ldquo;now split by plan&rdquo;) instead of starting over.
        </li>
        <li>
          <strong>Saved, shareable dashboards</strong> whose provenance travels with them, so a teammate can check a number without re-running anything.
        </li>
      </List>
      <Todo>Close with what you learned and what you&apos;d want to explore with the Dreambase team.</Todo>
    </Article>
  );
}
