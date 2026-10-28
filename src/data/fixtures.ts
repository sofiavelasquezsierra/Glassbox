import type { MetricView } from "@/lib/run-types";
import type { Assumption, MetricReview, PlanMetric, QueryResult } from "@/lib/schemas";
import raw from "./fixtures.json";

/**
 * Real agent output recorded on 2026-10-28, used by /system so every
 * specimen shows genuine SQL, verdicts and rows rather than invented data.
 */
interface RawMetric {
  metric: PlanMetric;
  sql?: string;
  explanation?: string;
  uses?: string[];
  review?: MetricReview;
  finalSql?: string | null;
  result?: QueryResult;
}
interface RawRun {
  plan: { assumptions: Assumption[]; metrics: PlanMetric[]; headline: string };
  metrics: Record<string, RawMetric>;
}

const toView = (m: RawMetric): MetricView => ({
  metric: m.metric,
  phase: m.result ? "done" : "error",
  sql: m.sql,
  explanation: m.explanation,
  finalSql: m.finalSql ?? undefined,
  uses: m.uses ?? [],
  review: m.review,
  result: m.result,
  error: m.result ? undefined : { stage: "validate", message: "Invalid model output after a repair attempt: summary: Too big: expected string to have <=160 characters" },
});

const tickets = raw.tickets as unknown as RawRun;
const engaged = raw.engaged as unknown as RawRun;

export const fixtureSource = raw.source;
export const ticketAssumptions = tickets.plan.assumptions;
export const fixtures = {
  kpi: toView(tickets.metrics.total_tickets!),
  line: toView(tickets.metrics.weekly_ticket_trend!),
  bar: toView(tickets.metrics.ticket_change_by_industry!),
  table: toView(tickets.metrics.ticket_change_by_category!),
  kpiShare: toView(engaged.metrics.engaged_org_share!),
  failed: toView(engaged.metrics.top_orgs_engagement!),
};
