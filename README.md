# Glassbox

**An AI analytics agent that shows its work.** Ask a business question in plain English about a fictional SaaS company; the agent states its assumptions as editable values, writes SQL, has a second agent review every query, runs it read-only against Supabase Postgres, and links every number to the SQL and rows behind it.

Built as a design-engineering portfolio piece. Pages: **Demo** (`/`), **Case study** (`/case-study`), **AI stack** (`/stack`, with real eval results), **Design system** (`/system`), **Resume** (`/resume`), and the **Data Dictionary** (`/dictionary`).

> All company data is fictional, generated from a fixed seed. The agent and reviewer are real Claude calls; the queries really run.

## Architecture

```
Browser                         Next.js route handlers (Node)                       Supabase Postgres
───────                         ────────────────────────────                        ─────────────────
Ask bar ──POST /api/run──────▶  rate limit → pipeline (async generator → SSE)
  ◀── SSE: step/plan/sql/          1 intent   claude-haiku-5-5   (tables, answerable?)
      review/result/errors         2 plan     claude-sonnet-5-5  (metrics + typed assumptions)
                                   3–5 per metric, in parallel:
                                     SQL     claude-sonnet-5-5  (:named params)
                                     review  claude-opus-5-5    (separate prompt; pass/warn/block, may rewrite)
                                     execute validate → EXPLAIN → READ ONLY txn ───────▶ role glassbox_reader
Assumption chip ─POST /api/rerun─▶ verify HMAC signature → execute with new params ──▶ (SELECT on northwind only)
Dictionary ─POST /api/dictionary/propose─▶ profile columns → claude-sonnet-5-5
                                 rate limits ──────────────────────────────────────▶ role glassbox_app (hit() only)
```

- **Streaming:** every Claude call streams; the server emits typed `RunEvent`s over SSE; the client reduces them (`src/lib/run-state.ts`). Recorded runs replay the same events.
- **Validation:** every model output is validated with Zod (`src/lib/schemas.ts`), plus semantic checks (SQL validity, unknown parameters, assumptions a query never uses). One repair turn, then a visible error.
- **SQL safety** (`src/server/sql/`): real Postgres grammar via `libpg-query`; exactly one `SELECT`; no data-modifying CTEs, `SELECT INTO`, row locks; function and table allowlists; `now()` rejected (dates resolve against a pinned `DEMO_AS_OF`); values always bound as parameters; `EXPLAIN` cost ceiling; `READ ONLY` transaction, 5 s `statement_timeout`, 1,000-row cap; a database role that can only `SELECT` from one schema.
- **Signed re-runs:** editing an assumption re-executes SQL the server signed (HMAC) with new parameters and no model call, so `/api/rerun` can't run arbitrary SQL.

### Repo map

| Path | What |
|---|---|
| `supabase/migrations/` | Schema (`northwind`), rate-limit function, least-privilege roles |
| `supabase/generate.ts`, `seed.ts`, `TRAPS.md` | Deterministic seed (mulberry32) and the data traps it plants |
| `src/server/sql/` | Param compiler, SELECT-only validator, executor |
| `src/server/agent/` | Pipeline, prompts, Claude streaming wrapper, dictionary profiler |
| `src/app/api/` | `run` (SSE), `rerun`, `dictionary/propose` |
| `src/components/system/` | Component library (documented at `/system`) |
| `src/components/demo/` | Demo page, dashboard, activity rail, Data Dictionary |
| `src/styles/tokens.css` | Design tokens (light + dark) |
| `src/data/runs/` | Recorded agent runs replayed in Recorded mode |
| `eval/golden.ts`, `scripts/eval.ts` | Golden set and eval runner → `src/data/eval-results.json` |

## Setup

Requirements: Node 20+, a Supabase project, an Anthropic API key.

1. **Install:** `npm install`
2. **Env:** `cp .env.example .env.local`, then set `ANTHROPIC_API_KEY` and `DATABASE_URL_ADMIN` (the project's `postgres` connection string; used only by local scripts). Generate `GLASSBOX_SIGNING_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
3. **Migrate:** `npm run db:migrate` applies `supabase/migrations/*.sql`, creates the roles, generates their passwords and writes `DATABASE_URL_READONLY` and `DATABASE_URL_APP` into `.env.local`.
4. **Seed:** `npm run db:seed` (deterministic; `-- --dry` to generate without writing).
5. **Verify the read-only role:** `npm run db:verify` attempts writes, escalation and cross-schema reads as the agent's role and expects all of them to fail (24 checks).
6. **Run:** `npm run dev`.

### The read-only role

From `supabase/migrations/0003_roles.sql`:

```sql
create role glassbox_reader login noinherit nocreatedb nocreaterole nosuperuser noreplication;
revoke all on schema public from glassbox_reader;
grant usage on schema northwind to glassbox_reader;
grant select on all tables in schema northwind to glassbox_reader;
alter default privileges in schema northwind grant select on tables to glassbox_reader;
alter role glassbox_reader set default_transaction_read_only = on;
alter role glassbox_reader set statement_timeout = '5s';
alter role glassbox_reader set search_path = northwind, pg_catalog;
```

The executor additionally opens every query in a `READ ONLY` transaction with `SET LOCAL statement_timeout`. Passwords are set by `db:migrate` from generated values and are never stored in SQL.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | server | Claude calls |
| `DATABASE_URL_READONLY` | server | `glassbox_reader`; for Vercel use the Supabase **transaction pooler** (port 6543, user `glassbox_reader.<project-ref>`) |
| `DATABASE_URL_APP` | server | `glassbox_app`, rate limiting only; pooler URL on Vercel |
| `GLASSBOX_SIGNING_SECRET` | server | HMAC for signed SQL. Must match the value used to record `src/data/runs`, or edits on recorded runs are rejected |
| `DATABASE_URL_ADMIN` | local scripts only | migrations and seed. **Never set on Vercel.** |
| `LIVE_RUNS_PER_HOUR`, `LIVE_RUNS_PER_DAY` | server, optional | live-run limits (default 5 per visitor per hour, 150 per day) |
| `GLASSBOX_MODEL_*` | server, optional | override models per step |
| `NEXT_PUBLIC_SITE_URL` | optional | absolute URL for Open Graph tags (Vercel's production URL is used otherwise) |

None of these are exposed to the browser; modules that read them import `server-only`.

## Scripts

| Command | |
|---|---|
| `npm test` | Vitest: SQL validator, params, schemas, seed determinism, run-state reducer, display SQL helpers |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ask -- "question"` | One live agent run in the terminal |
| `npm run eval` | Golden set → `src/data/eval-results.json` (≈ $1 per full run). `-- --regrade` re-scores saved traces; `-- --truth` prints ground truth |
| `npm run record` | Re-record the four suggested-question runs |
| `npm run dictionary:propose` | Re-record the agent's Data Dictionary proposals |

## Dependencies, and why each one

| Package | Why |
|---|---|
| `next`, `react`, `react-dom` | App Router, route handlers for SSE, static pages for content |
| `@anthropic-ai/sdk` | Streaming, structured outputs, typed errors |
| `zod` | One schema for structured-output requests, server validation and event types |
| `postgres` | Small, fast driver; works with Supabase's transaction pooler (`prepare: false`) and exposes column types for result formatting |
| `libpg-query` | The real Postgres parser (WASM). Validating against the actual grammar beats regex or a partial JS parser, and it fails closed |
| `@visx/scale` | Scales only. Marks are hand-drawn SVG so the design tokens control every pixel and Motion can tween values when an assumption changes. **Chosen over Recharts**, which imposes its own look and re-mounts animations on data change |
| `motion` | Status transitions, chart tweening, panel entry, with reduced-motion support |
| `tailwindcss` (+ `@tailwindcss/postcss`) | Utilities mapped onto CSS-variable tokens |
| `server-only` | Build-time guard that secrets-reading modules never reach the client |
| dev: `typescript`, `vitest`, `tsx` | Types, tests, scripts |

Deliberately not used: a component kit, a SQL highlighter (a small tokenizer suffices), a diff library (line LCS is ~30 lines), pdf.js (native `<object>`), Redis (Postgres handles rate limits).

## Decisions and trade-offs

- **Per-metric parallel chains** (SQL → review → execute per metric) instead of one call per step: charts arrive one at a time, and the retention question went from 87 s to 51 s. Costs a little more input (mitigated by prompt caching, ≈ 57% of input tokens are cache reads).
- **Edits don't call a model.** Instant and free, but the reviewer checked the queries with the agent's original values; the UI says so.
- **The reviewer can block.** A blocked chart shows why instead of a number the reviewer believes is wrong.
- **Neutral deltas.** The agent can't know whether "up" is good for an arbitrary metric, so the delta isn't colored.
- **Pinned "today"** (`2026-10-28`) and `now()` rejected: reproducible results and a meaningful eval, at the cost of slight oddness.
- **Per-visitor Data Dictionary** in localStorage: one visitor's edits can't change another's agent context. Not shared across devices.
- **Recorded runs by default:** first-time visitors watch a real trace for free; per-step timers are hidden on replays because waits are compressed.
- **Strict eval:** ground truth is never adjusted to agent output. Most failures are defensible alternative definitions; they're documented on `/stack` rather than graded away.

## Known limitations

- One shared demo database; no auth or tenant isolation.
- The validator allowlists functions and tables; legitimate but unlisted functions are rejected.
- The reviewer is itself a model and can miss things (e.g. in one eval run it claimed the schema had no refunds; they're stored as negative invoice rows).
- Eval results vary run to run; the page shows the latest run plus history, not pass@k.
- Rate limiting keys on a hashed IP from `x-forwarded-for`, which is appropriate on Vercel but not behind arbitrary proxies.
- Recorded runs and signed re-runs depend on a stable `GLASSBOX_SIGNING_SECRET`.
- `TODO(you)` placeholders remain for author-provided content (intro, Figma exports, video, resume).
