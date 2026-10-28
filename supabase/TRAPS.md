# Planted traps in the Northwind Cloud seed

The seed (`supabase/generate.ts`, seed `20261028`) contains realistic data problems that a
careless query gets wrong. The reviewer agent is expected to catch them, and the golden-set
eval checks answers that depend on them. Numbers below were measured on the seeded database.

| Trap | Where | What goes wrong | Measured effect |
|---|---|---|---|
| **Test-account leakage** | `organizations.is_test` (12 orgs), `users.is_internal` (145 users, `@northwind-cloud.test`) | "Load Test (synthetic)" fires ~14k events in two bursts (Sep 22–23, Oct 6–7). Four test orgs carry "paid" Enterprise invoices. Northwind support staff are members of ~1 in 8 customer orgs. | Top "most engaged" org since Jul 1 is the load test (14,138 events vs 4,741 for the top real org). Paid revenue is inflated by ~$4.6k/month. |
| **Upgrades look like churn** | `subscriptions.canceled_at` + `cancel_reason` | A plan change closes the old subscription row (`cancel_reason = 'upgrade' \| 'downgrade'`) and opens a new one. | 305 rows have `canceled_at`; only 129 are real churn. |
| **Join fan-out** | `organizations → subscriptions` (681 rows for 505 orgs), `invoices × events` | Joining orgs to all subscriptions, or invoices to events, multiplies sums. | Any `sum(invoices.amount_cents)` joined through `subscriptions` by `org_id` double counts orgs with plan changes. |
| **Timezone boundaries** | `events.occurred_at`, `invoices.issued_at` (timestamptz, UTC) | LA orgs run an end-of-quarter export push on the evening of **June 30 local time**, which is already July 1 in UTC. Invoices are issued at 00:00 *org-local* time, so Tokyo/Sydney invoices land on the previous UTC day. | LA-org events in Q3: 30,009 in UTC vs 26,538 in America/Los_Angeles; 3,479 fall in the first 8 UTC hours of Jul 1. |
| **NULLs** | `subscriptions.plan_id` (11 grandfathered contracts), `users.last_seen_at` (396 never logged in), `support_tickets.priority` (253 filed by email), `support_tickets.user_id`, `resolved_at` | Inner joins to `plans` silently drop grandfathered MRR; `avg(last_seen_at)`-style logic and `priority = ...` filters drop rows. | |
| **Refunds are negative rows** | `invoices.amount_cents < 0` (19 rows) | `count(*)` of invoices overstates billing events; `max(amount_cents)` style logic is wrong. | |
| **Trialing ≠ paying** | `subscriptions.status = 'trialing'` | Recent paid signups carry plan MRR but no invoices yet. | |
| **Legacy pricing** | `plans` id 6 "Team (2024 pricing)", `is_legacy` | Team price rose from $79 to $99 for new subscriptions on 2026-05-15; grouping by `plans.name` splits Team in two. | |

## Story beats (for "is the agent seeing reality?" checks)

- **Seasonality:** activity dips Dec 20–Jan 2 (×0.45) and across August (×0.72); signups dip in Dec and Aug.
- **AI Insights launch (2026-03-10):** upgrades jump in April (27) and May (20); the `ai_insights` feature ramps from 0.
- **Price change (2026-05-15):** billing tickets spike for ~3 weeks; churn on the legacy Team plan peaks in July (17).
- **Webhook incident (2026-08-11 → 08-14):** the week of Aug 10 has 99 tickets (45 integrations) vs a ~40/week baseline; integration feature usage drops.
- **Fixed clock:** data runs 2025-11-01 → 2026-10-27; the demo's "today" is 2026-10-28 (`DEMO_AS_OF`).
