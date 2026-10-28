# Glassbox: conventions

Portfolio demo: an AI analytics agent that shows its work over a fictional Supabase dataset (Northwind Cloud).
Built in phases (schema → agent → design system → demo UI → cached mode/polish → content/deploy), one commit per phase.

## Commands
- `npm test`: vitest (validator, params, schemas, seed determinism)
- `npm run typecheck`
- `npm run db:migrate`, `npm run db:seed` (`-- --dry` to generate only), `npm run db:verify`
- `npm run ask -- "question"`: one live agent run in the terminal (costs API money)
- `npm run eval`: golden set (eval/golden.ts) → src/data/eval-results.json; `-- --regrade` re-scores saved traces for free
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
- Keep dependencies minimal; justify additions in the README.
- Code style: TypeScript strict, `noUncheckedIndexedAccess`; comments explain *why*, sparingly.
