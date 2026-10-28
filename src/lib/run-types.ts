import type { MetricReview, PlanMetric, QueryResult } from "./schemas";

/** Where one metric is in its SQL → review → execute chain, as the UI sees it. */
export type MetricPhase = "planned" | "writing" | "reviewing" | "running" | "done" | "rerunning" | "error" | "blocked";

export interface MetricView {
  metric: PlanMetric;
  phase: MetricPhase;
  sql?: string;
  explanation?: string;
  /** SQL that actually ran (the reviewer's rewrite when there is one). */
  finalSql?: string;
  signature?: string;
  /** Assumption keys whose parameters appear in the final SQL. */
  uses: string[];
  review?: MetricReview;
  result?: QueryResult;
  error?: { stage: string; message: string };
}
