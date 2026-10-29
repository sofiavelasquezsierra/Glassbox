# Glassbox: conventions

Portfolio demo: an AI analytics agent that shows its work over a fictional Supabase dataset (Northwind Cloud).
Built in phases (schema → agent → design system → demo UI → cached mode/polish → content/deploy), one commit per phase.

## Commands
- `npm test`: vitest (validator, params, schemas, seed determinism)
- `npm run typecheck`
- `npm run db:migrate`, `npm run db:seed` (`-- --dry` to generate only), `npm run db:verify`
- `npm run ask -- "question"`: one live agent run in the terminal (costs API money)
- `npm run eval`: golden set (eval/golden.ts) → src/data/eval-results.json; `-- --regrade` re-scores saved traces for free
- `npm run record` (re-record suggested-question runs), `npm run dictionary:propose`
- `npm run dev` / `npm run build`
- Scripts that import `src/server/**` run with `tsx --conditions=react-server` (so `server-only` resolves)

## Rules
- **Secrets are server-only.** `ANTHROPIC_API_KEY` and `DATABASE_URL_*` are read only under `src/server/**`. Modules that read env import `server-only`. Never add `NEXT_PUBLIC_` secrets. `DATABASE_URL_ADMIN` is for local scripts only.
- **Agent SQL never gets string-interpolated values.** It uses `:named` placeholders compiled by `src/server/sql/params.ts`. Dates resolve against the fixed `DEMO_AS_OF`; `now()`/`CURRENT_DATE` are rejected by the validator.
- **Every query passes `validateSelect`** (`src/server/sql/validate.ts`, real PG grammar via libpg-query, fail-closed allowlists) before EXPLAIN and execution as `glassbox_reader` in a READ ONLY transaction.
- **Agent pipeline** (`src/server/agent/pipeline.ts`): intent (Haiku) → plan (Sonnet) → per metric in parallel: SQL (Sonnet) → review (Opus, separate prompt) → execute. Re-runs after an assumption edit only re-execute signed SQL (`src/server/sign.ts`), no model calls.
- **Every model output is validated with Zod** (`src/lib/schemas.ts`); one repair retry, then the step errors visibly.
- **The seed is deterministic** (`supabase/generate.ts`, mulberry32, no clock). If you change it, re-run `db:seed`, update `supabase/TRAPS.md` numbers, and re-run the eval.
- **Eval honesty:** never edit ground truth to match agent output; truth definitions are documented in `eval/golden.ts`. Keep every full run in `history`.
- **Honesty:** never invent user research, metrics, quotes or eval results. Placeholders for content only the author can provide are marked `TODO(you):`.
- **Content pages quote only measured numbers.** /stack and /case-study read stats from `src/data/runs` and `src/data/eval-results.json` (`src/lib/run-stats.ts`); never hand-type a number that can drift. Verify any claim about agent behaviour against saved traces.
- **UI:** use tokens from `src/styles/tokens.css` (no raw hex in components). Dark is the default theme (light via `data-theme="light"`); mint `--brand` is for actions/emphasis only (text on light uses `--brand-ink`); amber is reserved for assumptions/changed state; pass is teal so it never reads as the brand; verdict colors never double as series. Fonts are Geist and Geist Mono; every state (loading, empty, error, partial) is designed; check new UI with axe and at 1440/820 in light and dark.
- Keep dependencies minimal; justify additions in the README.
- Code style: TypeScript strict, `noUncheckedIndexedAccess`; comments explain *why*, sparingly.
