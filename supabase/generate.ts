/**
 * Deterministic generator for Northwind Cloud, a fictional SaaS company.
 *
 * Pure function of SEED: no clock, no I/O, no Math.random. Every planted
 * trap the reviewer agent should catch is documented in supabase/TRAPS.md.
 */

import { createHash } from "node:crypto";

export const SEED = 20261028;

/** First and last calendar days of in-period activity (events, invoices, tickets). */
export const PERIOD_START = Date.UTC(2025, 10, 1); // 2025-11-01
export const PERIOD_END_EX = Date.UTC(2026, 9, 28); // exclusive: data runs through 2026-10-27 UTC

const DAY = 86_400_000;
const HOUR = 3_600_000;

// ── RNG ──────────────────────────────────────────────────────────────────────

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float() {
    return this.next();
  }
  chance(p: number) {
    return this.next() < p;
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]!;
  }
  weighted<T>(pairs: readonly (readonly [T, number])[]): T {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of pairs) {
      if ((r -= w) < 0) return v;
    }
    return pairs[pairs.length - 1]![0];
  }
  normal(mean = 0, sd = 1) {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  lognormal(sd: number) {
    return Math.exp(this.normal(0, sd));
  }
  poisson(lambda: number) {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l);
    return k - 1;
  }
}

// ── Timezones ────────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();
const offsetCache = new Map<string, number>();

/** Offset of `tz` from UTC in ms at instant `ms`, cached per hour. */
function tzOffset(tz: string, ms: number): number {
  const bucket = Math.floor(ms / HOUR);
  const key = `${tz}|${bucket}`;
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(tz, f);
  }
  const at = bucket * HOUR;
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
  const off = asUtc - at;
  offsetCache.set(key, off);
  return off;
}

/** Converts a wall-clock time in `tz` on the calendar day `dayMs` (UTC midnight) to a UTC instant. */
function localToUtc(dayMs: number, minutesIntoDay: number, tz: string): number {
  const wall = dayMs + minutesIntoDay * 60_000;
  let t = wall - tzOffset(tz, wall);
  const corrected = wall - tzOffset(tz, t);
  if (corrected !== t) t = corrected;
  return t;
}

// ── Reference data ───────────────────────────────────────────────────────────

export const PLANS = [
  { id: 1, name: "Free", tier: "free", monthly_price_cents: 0, is_legacy: false },
  { id: 2, name: "Starter", tier: "starter", monthly_price_cents: 2_900, is_legacy: false },
  { id: 3, name: "Team", tier: "team", monthly_price_cents: 9_900, is_legacy: false },
  { id: 4, name: "Business", tier: "business", monthly_price_cents: 29_900, is_legacy: false },
  { id: 5, name: "Enterprise", tier: "enterprise", monthly_price_cents: 99_900, is_legacy: false },
  { id: 6, name: "Team (2024 pricing)", tier: "team", monthly_price_cents: 7_900, is_legacy: true },
] as const;

type Tier = (typeof PLANS)[number]["tier"] | "grandfathered";

/** Team price rises from $79 to $99 for new subscriptions on this date. */
const TEAM_PRICE_CHANGE = Date.UTC(2026, 4, 15);
/** "AI Insights" ships; upgrades and feature usage jump afterwards. */
const AI_LAUNCH = Date.UTC(2026, 2, 10);
/** Webhook delivery outage: integration tickets spike. */
const INCIDENT_START = Date.UTC(2026, 7, 11);
const INCIDENT_END = Date.UTC(2026, 7, 15);

const TIMEZONES: [string, number][] = [
  ["America/New_York", 0.25],
  ["America/Los_Angeles", 0.22],
  ["Europe/London", 0.13],
  ["Europe/Berlin", 0.14],
  ["Asia/Tokyo", 0.08],
  ["Australia/Sydney", 0.07],
  ["UTC", 0.11],
];
const COUNTRY_BY_TZ: Record<string, string[]> = {
  "America/New_York": ["US", "US", "US", "CA"],
  "America/Los_Angeles": ["US", "US", "US", "CA", "MX"],
  "Europe/London": ["GB", "GB", "IE"],
  "Europe/Berlin": ["DE", "DE", "NL", "FR", "SE", "PL"],
  "Asia/Tokyo": ["JP", "JP", "KR"],
  "Australia/Sydney": ["AU", "AU", "NZ"],
  UTC: ["IN", "BR", "NG", "AE", "SG", "ZA"],
};
const INDUSTRIES = ["Healthcare", "Logistics", "Fintech", "E-commerce", "Education", "Media", "Manufacturing", "Energy", "Developer tools", "Nonprofit"];
const NAME_A = ["Fern", "Copper", "Lumen", "Brightwater", "Quill", "Harbor", "Tamarind", "Basalt", "Juniper", "Kestrel", "Marlow", "Orchard", "Pebble", "Saffron", "Tidewell", "Verity", "Wren", "Yarrow", "Alder", "Birch", "Cinder", "Driftwood", "Ember", "Glimmer", "Hollow", "Ivory", "Jasper", "Kiln", "Larch", "Mossgate", "Nimbus", "Opaline", "Pinecrest", "Quartzline", "Rookery", "Sable", "Thistle", "Umber", "Vale", "Willowmere"];
const NAME_B = ["Labs", "Analytics", "Health", "Logistics", "Studio", "Systems", "Bio", "Robotics", "Foods", "Finance", "Works", "Collective", "Supply", "Learning", "Energy", "Media"];
const FIRST = ["ana", "ben", "chen", "dara", "eli", "farah", "gus", "hana", "ivan", "jo", "kofi", "lena", "mateo", "nia", "omar", "priya", "quinn", "rosa", "sam", "tariq", "uma", "vik", "wei", "xena", "yusuf", "zoe"];
const LAST = ["abara", "berg", "costa", "diaz", "eze", "fischer", "garcia", "hughes", "ito", "jensen", "kim", "lopez", "moreau", "nakamura", "okafor", "patel", "quist", "rossi", "silva", "tanaka", "ueda", "varga", "walsh", "yilmaz", "zhou"];
const FEATURES = ["dashboards", "sql_editor", "alerts", "exports", "integrations", "ai_insights"] as const;
const TICKET_CATEGORIES: [string, number][] = [
  ["bug", 0.22],
  ["billing", 0.18],
  ["integrations", 0.17],
  ["feature_request", 0.15],
  ["performance", 0.14],
  ["account", 0.14],
];

// ── Row types ────────────────────────────────────────────────────────────────

export interface OrgRow { id: number; name: string; industry: string; country: string; timezone: string; created_at: Date; is_test: boolean }
export interface UserRow { id: number; org_id: number; email: string; role: string; created_at: Date; last_seen_at: Date | null; is_internal: boolean }
export interface SubRow { id: number; org_id: number; plan_id: number | null; status: string; started_at: Date; canceled_at: Date | null; cancel_reason: string | null; mrr_cents: number }
export interface InvoiceRow { id: number; org_id: number; subscription_id: number; amount_cents: number; status: string; issued_at: Date; paid_at: Date | null }
export interface EventRow { id: number; user_id: number; org_id: number; type: string; feature: string | null; occurred_at: Date }
export interface TicketRow { id: number; org_id: number; user_id: number | null; category: string; priority: string | null; created_at: Date; resolved_at: Date | null }

export interface Dataset {
  plans: typeof PLANS;
  organizations: OrgRow[];
  users: UserRow[];
  subscriptions: SubRow[];
  invoices: InvoiceRow[];
  events: EventRow[];
  support_tickets: TicketRow[];
}

// ── Seasonality ──────────────────────────────────────────────────────────────

const SIGNUPS_BY_MONTH = [1.1, 1.0, 1.3, 1.2, 1.1, 1.0, 0.95, 0.65, 1.15, 1.1, 1.0, 0.6]; // Jan..Dec

function activitySeason(dayMs: number): number {
  const d = new Date(dayMs);
  const m = d.getUTCMonth();
  const dom = d.getUTCDate();
  if ((m === 11 && dom >= 20) || (m === 0 && dom <= 2)) return 0.45;
  if (m === 7) return 0.72;
  if (m === 11) return 0.9;
  // Gentle growth through the year.
  return 0.92 + 0.1 * ((dayMs - PERIOD_START) / (PERIOD_END_EX - PERIOD_START));
}

function dowFactor(dayMs: number): number {
  const dow = new Date(dayMs).getUTCDay();
  return dow === 0 || dow === 6 ? 0.25 : 1;
}

// ── Generator ────────────────────────────────────────────────────────────────

interface OrgSim {
  row: OrgRow;
  tier: Tier;
  churnedAt: number | null;
  activity: number;
  subs: SubRow[];
}

export function generate(seed: number = SEED): Dataset {
  const rng = new Rng(seed);
  const orgs: OrgSim[] = [];
  const users: UserRow[] = [];
  const subscriptions: SubRow[] = [];
  const invoices: InvoiceRow[] = [];
  const events: EventRow[] = [];
  const tickets: TicketRow[] = [];
  const usedNames = new Set<string>();
  const ids = { org: 1, user: 1, sub: 1, invoice: 1, event: 1, ticket: 1 };

  const orgName = () => {
    for (;;) {
      const n = `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };

  const businessMinute = () => Math.round(Math.min(22 * 60, Math.max(6 * 60, rng.normal(10.5 * 60, 150))));

  // ── Organizations: 200 that predate the period, ~280 that sign up during it.
  const createdDays: number[] = [];
  const histStart = Date.UTC(2023, 0, 1);
  for (let i = 0; i < 200; i++) {
    // Skew toward recent signups.
    const f = Math.sqrt(rng.float());
    createdDays.push(histStart + Math.floor(f * ((PERIOD_START - histStart) / DAY)) * DAY);
  }
  for (let day = PERIOD_START; day < PERIOD_END_EX; day += DAY) {
    const rate = (23 / 30) * SIGNUPS_BY_MONTH[new Date(day).getUTCMonth()]! * (dowFactor(day) === 1 ? 1.15 : 0.6);
    const n = rng.poisson(rate);
    for (let k = 0; k < n; k++) createdDays.push(day);
  }
  createdDays.sort((a, b) => a - b);

  const grandfatheredBudget = { left: 20 };
  for (const day of createdDays) {
    const tz = rng.weighted(TIMEZONES);
    const created = localToUtc(day, businessMinute(), tz);
    const row: OrgRow = {
      id: ids.org++,
      name: orgName(),
      industry: rng.pick(INDUSTRIES),
      country: rng.pick(COUNTRY_BY_TZ[tz]!),
      timezone: tz,
      created_at: new Date(created),
      is_test: false,
    };
    let tier: Tier;
    if (created < Date.UTC(2024, 5, 1) && grandfatheredBudget.left > 0 && rng.chance(0.3)) {
      grandfatheredBudget.left--;
      tier = "grandfathered";
    } else {
      tier = rng.weighted<Tier>([
        ["free", 0.45],
        ["starter", 0.25],
        ["team", 0.2],
        ["business", 0.08],
        ["enterprise", 0.02],
      ]);
    }
    orgs.push({ row, tier, churnedAt: null, activity: rng.lognormal(0.45), subs: [] });
  }

  // ── Test organizations (trap: test-account leakage).
  const testNames = ["QA Sandbox", "Northwind Internal", "Demo – Sales Engineering", "TEST Billing Staging", "Load Test (synthetic)", "qa-automation-01", "qa-automation-02", "Partner Demo Tenant", "TEST Enterprise Trial", "Onboarding Dry Run", "Support Repro Org", "Security Review Tenant"];
  const testOrgs: OrgSim[] = testNames.map((name, i) => ({
    row: {
      id: ids.org++,
      name,
      industry: "Developer tools",
      country: "US",
      timezone: "UTC",
      created_at: new Date(Date.UTC(2025, 2 + (i % 8), 3 + i, 15)),
      is_test: true,
    },
    tier: i < 4 ? "enterprise" : "team",
    churnedAt: null,
    activity: 1,
    subs: [],
  }));
  orgs.push(...testOrgs);

  // ── Subscriptions: monthly lifecycle simulation.
  const tierPlan = (tier: Tier, at: number): number | null => {
    switch (tier) {
      case "free": return 1;
      case "starter": return 2;
      case "team": return at < TEAM_PRICE_CHANGE ? 6 : 3;
      case "business": return 4;
      case "enterprise": return 5;
      case "grandfathered": return null;
    }
  };
  const planPrice = (planId: number | null) => PLANS.find((p) => p.id === planId)?.monthly_price_cents ?? 0;
  const UP: Partial<Record<Tier, Tier>> = { free: "starter", starter: "team", team: "business", business: "enterprise" };
  const DOWN: Partial<Record<Tier, Tier>> = { enterprise: "business", business: "team", team: "starter" };

  for (const org of orgs) {
    const isTest = org.row.is_test;
    let at = org.row.created_at.getTime();
    let tier = org.tier;
    const openSub = (start: number, t: Tier) => {
      const plan_id = tierPlan(t, start);
      const mrr = t === "grandfathered" ? rng.int(9, 36) * 500 : planPrice(plan_id);
      const sub: SubRow = { id: ids.sub++, org_id: org.row.id, plan_id, status: "active", started_at: new Date(start), canceled_at: null, cancel_reason: null, mrr_cents: mrr };
      org.subs.push(sub);
      return sub;
    };
    let sub = openSub(at, tier);

    for (let step = at + 30 * DAY; step < PERIOD_END_EX; step += 30 * DAY) {
      if (isTest) break;
      const month = new Date(step).getUTCMonth();
      const year = new Date(step).getUTCFullYear();
      const churnBase: Record<Tier, number> = { free: 0.03, starter: 0.035, team: 0.025, business: 0.015, enterprise: 0.007, grandfathered: 0.006 };
      let churnP = churnBase[tier];
      if (tier === "team" && sub.plan_id === 6 && year === 2026 && (month === 5 || month === 6)) churnP *= 4; // price change backlash
      if (month === 11) churnP *= 1.3;
      let upP = UP[tier] ? (tier === "free" ? 0.04 : tier === "team" ? 0.025 : 0.035) : 0;
      if (step >= AI_LAUNCH && step < AI_LAUNCH + 60 * DAY) upP *= 2.6;
      const downP = DOWN[tier] ? 0.008 : 0;

      const r = rng.float();
      const when = step + rng.int(0, 29) * DAY + rng.int(0, 23) * HOUR;
      if (when >= PERIOD_END_EX) break;
      if (r < churnP) {
        sub.status = "canceled";
        sub.canceled_at = new Date(when);
        sub.cancel_reason = "churn";
        org.churnedAt = when;
        break;
      } else if (r < churnP + upP || r < churnP + upP + downP) {
        const next = (r < churnP + upP ? UP[tier] : DOWN[tier])!;
        // Trap: plan changes close the old subscription row, so counting
        // canceled_at without cancel_reason overstates churn.
        sub.status = "canceled";
        sub.canceled_at = new Date(when);
        sub.cancel_reason = r < churnP + upP ? "upgrade" : "downgrade";
        tier = next;
        sub = openSub(when, tier);
        at = when;
      }
    }
    org.tier = tier;
    // Recent paid signups are still trialing (trap: trialing is not paying).
    if (!org.churnedAt && sub.plan_id !== 1 && PERIOD_END_EX - sub.started_at.getTime() < 14 * DAY && org.subs.length === 1) {
      sub.status = "trialing";
    } else if (!org.churnedAt && sub.mrr_cents > 0 && rng.chance(0.03)) {
      sub.status = "past_due";
    }
    subscriptions.push(...org.subs);
  }

  // ── Users.
  const userRange: Record<Tier, [number, number]> = { free: [1, 4], starter: [2, 7], team: [5, 22], business: [14, 50], enterprise: [35, 90], grandfathered: [8, 28] };
  const orgUsers = new Map<number, UserRow[]>();
  const engagement = new Map<number, number>();
  for (const org of orgs) {
    const list: UserRow[] = [];
    const slug = org.row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const [lo, hi] = org.row.is_test ? [3, 8] : userRange[org.tier];
    const n = rng.int(lo, hi);
    const born = org.row.created_at.getTime();
    const until = Math.min(org.churnedAt ?? PERIOD_END_EX, PERIOD_END_EX) - HOUR;
    const usedEmails = new Set<string>();
    for (let k = 0; k < n; k++) {
      const created = k === 0 ? born + 5 * 60_000 : born + rng.float() * Math.max(until - born, DAY) * 0.8;
      const role = k === 0 ? "owner" : rng.weighted([["admin", 0.15], ["member", 0.65], ["viewer", 0.2]] as const);
      let email: string;
      if (org.row.is_test) email = `qa${org.row.id}.${k + 1}@northwind-cloud.test`;
      else {
        let base = `${rng.pick(FIRST)}.${rng.pick(LAST)}`;
        while (usedEmails.has(base)) base += rng.int(1, 9);
        usedEmails.add(base);
        email = `${base}@${slug}.example`;
      }
      const u: UserRow = { id: ids.user++, org_id: org.row.id, email, role, created_at: new Date(created), last_seen_at: null, is_internal: org.row.is_test };
      list.push(u);
      const roleE = { owner: 0.42, admin: 0.36, member: 0.26, viewer: 0.1 }[role];
      const tierE = org.tier === "free" ? 0.45 : org.tier === "enterprise" ? 1.15 : 1;
      engagement.set(u.id, Math.min(0.9, Math.max(0.01, 0.42 * roleE * tierE * org.activity * rng.lognormal(0.55))));
    }
    // Trap: Northwind support staff are members of ~1 in 8 customer orgs.
    if (!org.row.is_test && rng.chance(0.125)) {
      const u: UserRow = { id: ids.user++, org_id: org.row.id, email: `support+${org.row.id}@northwind-cloud.test`, role: "admin", created_at: new Date(born + 2 * DAY), last_seen_at: null, is_internal: true };
      list.push(u);
      engagement.set(u.id, 0.08);
    }
    orgUsers.set(org.row.id, list);
    users.push(...list);
  }

  // ── Events.
  const featureWeights = (day: number): [string, number][] => {
    const aiShare = day < AI_LAUNCH ? 0 : Math.min(0.24, 0.06 + (0.18 * (day - AI_LAUNCH)) / (120 * DAY));
    return [
      ["dashboards", 0.32],
      ["sql_editor", 0.2],
      ["alerts", 0.12],
      ["exports", 0.12],
      ["integrations", day >= INCIDENT_START && day < INCIDENT_END ? 0.03 : 0.12],
      ["ai_insights", aiShare],
    ];
  };
  const pushEvent = (u: UserRow, type: string, feature: string | null, t: number) => {
    if (t < PERIOD_START || t >= PERIOD_END_EX) return;
    events.push({ id: ids.event++, user_id: u.id, org_id: u.org_id, type, feature, occurred_at: new Date(t) });
  };
  const lastSeen = new Map<number, number>();

  const quarterEndLA = Date.UTC(2026, 5, 30);
  for (const org of orgs) {
    if (org.row.is_test) continue;
    const tz = org.row.timezone;
    const list = orgUsers.get(org.row.id)!;
    const churn = org.churnedAt;
    for (const u of list) {
      const e = engagement.get(u.id)!;
      const from = Math.max(PERIOD_START, Math.floor(u.created_at.getTime() / DAY) * DAY);
      const to = Math.min(PERIOD_END_EX, churn ? churn + 3 * DAY : PERIOD_END_EX);
      for (let day = from; day < to; day += DAY) {
        let p = e * dowFactor(day) * activitySeason(day);
        // Engagement fades in the six weeks before an org churns.
        if (churn && day > churn - 42 * DAY) p *= Math.max(0.1, (churn - day) / (42 * DAY));
        if (!rng.chance(p)) continue;
        const loginMin = businessMinute();
        const login = localToUtc(day, loginMin, tz);
        if (login < u.created_at.getTime()) continue;
        pushEvent(u, "login", null, login);
        lastSeen.set(u.id, login);
        const k = rng.poisson(1.15 * (day >= AI_LAUNCH ? 1.12 : 1));
        const fw = featureWeights(day);
        for (let j = 0; j < k; j++) {
          const t = login + rng.int(1, 180) * 60_000;
          pushEvent(u, "feature_used", rng.weighted(fw), t);
          lastSeen.set(u.id, Math.max(lastSeen.get(u.id)!, t));
        }
      }
      // Trap: end-of-quarter reporting push in LA orgs on the evening of
      // June 30 local time, which is already July 1 in UTC.
      if (tz === "America/Los_Angeles" && e > 0.08 && (!churn || churn > quarterEndLA + DAY) && u.created_at.getTime() < quarterEndLA) {
        const k = rng.int(3, 7);
        for (let j = 0; j < k; j++) {
          const t = localToUtc(quarterEndLA, rng.int(17 * 60, 23 * 60 + 50), tz);
          pushEvent(u, "feature_used", "exports", t);
          lastSeen.set(u.id, Math.max(lastSeen.get(u.id) ?? 0, t));
        }
      }
    }
  }

  // Test org activity, including a synthetic load test (trap: most "engaged" org).
  for (const org of testOrgs) {
    const list = orgUsers.get(org.row.id)!;
    const isLoad = org.row.name.startsWith("Load Test");
    for (let day = PERIOD_START; day < PERIOD_END_EX; day += DAY) {
      for (const u of list) {
        const p = isLoad ? 0.1 : 0.2;
        if (!rng.chance(p * dowFactor(day))) continue;
        const login = day + rng.int(13 * 60, 22 * 60) * 60_000;
        pushEvent(u, "login", null, login);
        lastSeen.set(u.id, login);
        for (let j = rng.poisson(2); j > 0; j--) pushEvent(u, "feature_used", rng.pick(FEATURES), login + rng.int(1, 60) * 60_000);
      }
    }
    if (isLoad) {
      const burst = [Date.UTC(2026, 8, 22), Date.UTC(2026, 8, 23), Date.UTC(2026, 9, 6), Date.UTC(2026, 9, 7)];
      for (const day of burst) {
        for (let j = 0; j < 3_500; j++) {
          const u = rng.pick(list);
          const t = day + rng.int(0, 86_399) * 1000;
          pushEvent(u, j % 5 === 0 ? "login" : "feature_used", j % 5 === 0 ? null : rng.pick(FEATURES), t);
          lastSeen.set(u.id, Math.max(lastSeen.get(u.id) ?? 0, t));
        }
      }
    }
  }
  events.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime() || a.id - b.id);
  events.forEach((ev, i) => (ev.id = i + 1));

  // last_seen_at: from in-period activity, else a pre-period guess for users of
  // older orgs, else NULL (trap: never-logged-in users have NULL last_seen_at).
  for (const u of users) {
    const seen = lastSeen.get(u.id);
    if (seen !== undefined) u.last_seen_at = new Date(seen);
    else if (u.created_at.getTime() < PERIOD_START - 7 * DAY && rng.chance(0.8)) {
      const span = PERIOD_START - u.created_at.getTime();
      u.last_seen_at = new Date(u.created_at.getTime() + rng.float() * span);
    }
  }

  // ── Invoices: monthly at 00:00 org-local time on the billing anniversary.
  // Trap: Tokyo/Sydney midnight is the previous day in UTC, so revenue by
  // month or quarter shifts depending on the timezone used.
  for (const org of orgs) {
    for (const sub of org.subs) {
      if (sub.mrr_cents === 0 || sub.status === "trialing") continue;
      const start = sub.started_at.getTime();
      const end = Math.min(sub.canceled_at?.getTime() ?? PERIOD_END_EX, PERIOD_END_EX);
      const anchorDay = Math.min(new Date(start).getUTCDate(), 28);
      const firstBill = start + (org.subs.length === 1 && start > PERIOD_START - 400 * DAY ? 14 * DAY : 0);
      const d0 = new Date(Math.max(firstBill, PERIOD_START - 31 * DAY));
      for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); ; m++) {
        const day = Date.UTC(y, m, anchorDay);
        const issued = localToUtc(day, 0, org.row.timezone);
        if (issued >= end) break;
        if (issued < firstBill || issued < PERIOD_START) continue;
        const isLastOpen = sub.status === "past_due" && issued > PERIOD_END_EX - 31 * DAY;
        // Test orgs: some invoices look paid (internal billing tests).
        const status = isLastOpen ? "open" : rng.chance(0.004) ? "void" : "paid";
        const paid_at = status === "paid" ? new Date(issued + rng.int(0, 5 * 24) * HOUR) : null;
        const inv: InvoiceRow = { id: ids.invoice++, org_id: org.row.id, subscription_id: sub.id, amount_cents: sub.mrr_cents, status, issued_at: new Date(issued), paid_at };
        invoices.push(inv);
        // Trap: refunds are separate negative rows.
        if (status === "paid" && !org.row.is_test && rng.chance(0.015)) {
          const refundAt = issued + rng.int(2, 20) * DAY;
          if (refundAt < PERIOD_END_EX) {
            const amount = rng.chance(0.6) ? -sub.mrr_cents : -Math.round(sub.mrr_cents * rng.float() * 0.8);
            invoices.push({ id: ids.invoice++, org_id: org.row.id, subscription_id: sub.id, amount_cents: amount, status: "paid", issued_at: new Date(refundAt), paid_at: new Date(refundAt) });
          }
        }
      }
    }
  }
  invoices.sort((a, b) => a.issued_at.getTime() - b.issued_at.getTime() || a.id - b.id);
  invoices.forEach((inv, i) => (inv.id = i + 1));

  // ── Support tickets.
  for (const org of orgs) {
    const list = orgUsers.get(org.row.id)!;
    const customers = list.filter((u) => !u.is_internal || org.row.is_test);
    if (customers.length === 0) continue;
    const base = (org.row.is_test ? 0.002 : 0.0045) * Math.pow(customers.length, 0.65);
    const from = Math.max(PERIOD_START, Math.floor(org.row.created_at.getTime() / DAY) * DAY);
    const to = Math.min(PERIOD_END_EX, org.churnedAt ?? PERIOD_END_EX);
    for (let day = from; day < to; day += DAY) {
      const incident = day >= INCIDENT_START && day < INCIDENT_END;
      const priceWindow = day >= TEAM_PRICE_CHANGE && day < TEAM_PRICE_CHANGE + 26 * DAY;
      const launchWindow = day >= AI_LAUNCH && day < AI_LAUNCH + 21 * DAY;
      let lambda = base * dowFactor(day) * (dowFactor(day) === 1 ? 1 : 2);
      const weights = TICKET_CATEGORIES.map(([c, w]): [string, number] => {
        if (c === "integrations" && incident) return [c, w * 9];
        if (c === "billing" && priceWindow) return [c, w * 3];
        if (c === "feature_request" && launchWindow) return [c, w * 2];
        return [c, w];
      });
      lambda *= weights.reduce((s, [, w]) => s + w, 0);
      for (let k = rng.poisson(lambda); k > 0; k--) {
        const category = rng.weighted(weights);
        const created = localToUtc(day, businessMinute(), org.row.timezone);
        if (created >= PERIOD_END_EX || created < org.row.created_at.getTime()) continue;
        const priority = rng.chance(0.12)
          ? null
          : incident && category === "integrations"
            ? rng.weighted([["normal", 0.3], ["high", 0.45], ["urgent", 0.25]] as const)
            : rng.weighted([["low", 0.28], ["normal", 0.52], ["high", 0.16], ["urgent", 0.04]] as const);
        const hours = Math.max(0.2, rng.lognormal(1.1) * (priority === "urgent" ? 3 : priority === "high" ? 8 : 20));
        const resolvedAt = created + hours * HOUR;
        const open = resolvedAt >= PERIOD_END_EX || rng.chance(0.04);
        tickets.push({
          id: ids.ticket++,
          org_id: org.row.id,
          user_id: rng.chance(0.1) ? null : rng.pick(customers).id,
          category,
          priority,
          created_at: new Date(created),
          resolved_at: open ? null : new Date(resolvedAt),
        });
      }
    }
  }
  tickets.sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id - b.id);
  tickets.forEach((t, i) => (t.id = i + 1));

  return {
    plans: PLANS,
    organizations: orgs.map((o) => o.row),
    users,
    subscriptions,
    invoices,
    events,
    support_tickets: tickets,
  };
}

// ── Manifest ─────────────────────────────────────────────────────────────────

export const TABLE_ORDER = ["plans", "organizations", "users", "subscriptions", "invoices", "events", "support_tickets"] as const;

/** Row counts and content hashes; identical output proves the seed is deterministic. */
export function manifest(data: Dataset) {
  const tables: Record<string, { rows: number; sha256: string }> = {};
  for (const t of TABLE_ORDER) {
    const h = createHash("sha256");
    for (const row of data[t]) h.update(JSON.stringify(row));
    tables[t] = { rows: data[t].length, sha256: h.digest("hex").slice(0, 16) };
  }
  return { seed: SEED, tables };
}
