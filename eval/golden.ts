/**
 * Golden questions with known answers over the deterministic seed.
 *
 * Each truth query was written by hand and encodes the definition a careful
 * analyst would use: test organizations are excluded everywhere, and activity
 * by Northwind staff (users.is_internal) never counts as customer activity; `trap` names the mistake it is designed to expose
 * (see supabase/TRAPS.md). Questions are phrased the way a founder would
 * ask, with just enough specificity that there is one defensible answer.
 *
 * Grading: for `number`, the agent's headline metric (the first KPI in its
 * plan, else its first metric) must have a first numeric value within
 * tolerance. For `label`, the headline breakdown's top row must match.
 */

export interface GoldenQuestion {
  id: string;
  question: string;
  kind: "number" | "label";
  /** Relative tolerance for numbers (0.01 = 1%). */
  tolerance?: number;
  unit?: "count" | "usd" | "percent";
  trap: string;
  truth: string;
}

const NOT_TEST = `o.is_test = false`;

export const GOLDEN: GoldenQuestion[] = [
  {
    id: "churned_orgs_q3",
    question: "How many customers churned in Q3 2026?",
    kind: "number",
    unit: "count",
    trap: "Plan changes close subscription rows; only cancel_reason = 'churn' is churn.",
    truth: `select count(distinct s.org_id) as value
      from subscriptions s join organizations o on o.id = s.org_id
      where s.cancel_reason = 'churn' and ${NOT_TEST}
        and s.canceled_at >= '2026-07-01' and s.canceled_at < '2026-10-01'`,
  },
  {
    id: "net_revenue_sep",
    question: "What was our paid revenue in September 2026, net of refunds?",
    kind: "number",
    unit: "usd",
    tolerance: 0.005,
    trap: "Test orgs carry paid invoices; refunds are negative invoice rows.",
    truth: `select round(sum(i.amount_cents) / 100.0, 2) as value
      from invoices i join organizations o on o.id = i.org_id
      where i.status = 'paid' and ${NOT_TEST}
        and i.issued_at >= '2026-09-01' and i.issued_at < '2026-10-01'`,
  },
  {
    id: "top_org_october",
    question: "Which organization had the most product activity in October 2026?",
    kind: "label",
    trap: "The synthetic load-test tenant has the most events by far.",
    truth: `select o.name as label, count(*) as value
      from events e join users u on u.id = e.user_id join organizations o on o.id = e.org_id
      where ${NOT_TEST} and not u.is_internal and e.occurred_at >= '2026-10-01' and e.occurred_at < '2026-11-01'
      group by 1 order by 2 desc limit 1`,
  },
  {
    id: "ticket_spike_category",
    question: "Which support ticket category spiked in the week of August 10, 2026?",
    kind: "label",
    trap: "Needs a week-over-baseline comparison, not just the biggest category overall.",
    truth: `with wk as (
        select category, count(*) n from support_tickets t join organizations o on o.id = t.org_id
        where ${NOT_TEST} and t.created_at >= '2026-08-10' and t.created_at < '2026-08-17' group by 1
      ), base as (
        select category, count(*) / 12.0 n from support_tickets t join organizations o on o.id = t.org_id
        where ${NOT_TEST} and t.created_at >= '2026-05-18' and t.created_at < '2026-08-10' group by 1
      )
      select wk.category as label, wk.n - base.n as value from wk join base using (category) order by 2 desc limit 1`,
  },
  {
    id: "active_customer_users_30d",
    question: "How many customer users were active in the last 30 days?",
    kind: "number",
    unit: "count",
    tolerance: 0.01,
    trap: "Northwind staff (is_internal) are members of customer orgs; test orgs too.",
    truth: `select count(distinct e.user_id) as value
      from events e join users u on u.id = e.user_id join organizations o on o.id = e.org_id
      where ${NOT_TEST} and not u.is_internal
        and e.occurred_at >= '2026-09-29' and e.occurred_at < '2026-10-29'`,
  },
  {
    id: "current_mrr",
    question: "What is our current MRR?",
    kind: "number",
    unit: "usd",
    tolerance: 0.005,
    trap: "Grandfathered contracts have NULL plan_id (inner joins drop them); trialing is not paying.",
    truth: `select round(sum(s.mrr_cents) / 100.0, 2) as value
      from subscriptions s join organizations o on o.id = s.org_id
      where ${NOT_TEST} and s.canceled_at is null and s.status in ('active', 'past_due')`,
  },
  {
    id: "la_feature_events_q3_local",
    question: "How many feature-usage events did our Los Angeles–timezone customers have in Q3 2026, using their local time?",
    kind: "number",
    unit: "count",
    tolerance: 0.002,
    trap: "Their June 30 evening push lands on July 1 in UTC.",
    truth: `select count(*) as value
      from events e join users u on u.id = e.user_id join organizations o on o.id = e.org_id
      where ${NOT_TEST} and not u.is_internal and o.timezone = 'America/Los_Angeles' and e.type = 'feature_used'
        and (e.occurred_at at time zone 'America/Los_Angeles') >= '2026-07-01'
        and (e.occurred_at at time zone 'America/Los_Angeles') < '2026-10-01'`,
  },
  {
    id: "team_paying_customers",
    question: "How many paying customers are on the Team plan right now?",
    kind: "number",
    unit: "count",
    trap: "Team exists as two plan rows (legacy pricing); filtering on plans.name = 'Team' misses most of them.",
    truth: `select count(distinct s.org_id) as value
      from subscriptions s join plans p on p.id = s.plan_id join organizations o on o.id = s.org_id
      where ${NOT_TEST} and p.tier = 'team' and s.canceled_at is null
        and s.status in ('active', 'past_due') and s.mrr_cents > 0`,
  },
  {
    id: "unresolved_share_october",
    question: "What share of support tickets opened in October 2026 are still unresolved?",
    kind: "number",
    unit: "percent",
    tolerance: 0.02,
    trap: "resolved_at IS NULL means open; averages over NULLs mislead.",
    truth: `select round(100.0 * count(*) filter (where t.resolved_at is null) / count(*), 1) as value
      from support_tickets t join organizations o on o.id = t.org_id
      where ${NOT_TEST} and t.created_at >= '2026-10-01' and t.created_at < '2026-11-01'`,
  },
  {
    id: "upgrades_april",
    question: "How many customers upgraded their plan in April 2026?",
    kind: "number",
    unit: "count",
    trap: "Upgrades are a cancel_reason on the old row, not a new-subscription count (which includes new signups).",
    truth: `select count(distinct s.org_id) as value
      from subscriptions s join organizations o on o.id = s.org_id
      where s.cancel_reason = 'upgrade' and ${NOT_TEST}
        and s.canceled_at >= '2026-04-01' and s.canceled_at < '2026-05-01'`,
  },
];
