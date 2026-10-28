/**
 * The system as built. Inline SVG drawn with design tokens so it follows
 * the theme. Read top to bottom: browser → server pipeline → Postgres.
 */
export function ArchitectureDiagram() {
  const box = "fill-[var(--surface)] stroke-[var(--rule-strong)]";
  const t = "fill-[var(--ink)] font-sans text-[13px]";
  const s = "fill-[var(--ink-3)] font-mono text-[10.5px]";
  const arrow = "stroke-[var(--ink-3)]";
  const steps: [string, string, string][] = [
    ["Intent", "Haiku 5.5", "tables, category"],
    ["Plan", "Sonnet 5.5", "metrics + typed assumptions"],
    ["SQL ×N", "Sonnet 5.5", "one per metric, :params"],
    ["Review ×N", "Opus 5.5", "separate prompt and role"],
    ["Execute ×N", "Postgres", "validate → EXPLAIN → run"],
  ];
  return (
    <figure className="my-8 font-sans">
      <svg viewBox="0 0 720 470" className="w-full" role="img" aria-labelledby="arch-title arch-desc">
        <title id="arch-title">Glassbox architecture</title>
        <desc id="arch-desc">
          The browser posts a question to a Next.js route that streams server-sent events. On the server, intent, plan, SQL, review and execute steps run, with SQL, review and execute fanned out per metric. Queries run as a read-only role against Supabase Postgres. Assumption edits call a separate re-run route that executes signed SQL without model calls.
        </desc>
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" className="fill-[var(--ink-3)]" />
          </marker>
        </defs>

        <text x="16" y="22" className={s}>BROWSER</text>
        <rect x="16" y="32" width="688" height="62" rx="8" className={box} />
        {[
          ["Ask bar", 40],
          ["Activity rail", 180],
          ["Assumption chips", 320],
          ["Charts + provenance", 480],
        ].map(([l, x]) => (
          <text key={l as string} x={x as number} y="68" className={t}>
            {l}
          </text>
        ))}

        <path d="M120 94 V140" className={arrow} markerEnd="url(#arr)" />
        <text x="128" y="122" className={s}>POST /api/run · SSE stream back</text>
        <path d="M400 94 V140" className={arrow} markerEnd="url(#arr)" />
        <text x="408" y="122" className={s}>POST /api/rerun · signed SQL, no model</text>

        <text x="16" y="158" className={s}>NEXT.JS SERVER (NODE) · keys + DB URLs never leave it</text>
        <rect x="16" y="166" width="688" height="186" rx="8" className={box} strokeDasharray="4 3" />
        <rect x="32" y="182" width="656" height="24" rx="4" className="fill-[var(--accent-wash-2)] stroke-[var(--accent)]" />
        <text x="44" y="198" className={s}>rate limit (hashed IP) → Zod-validated request → data dictionary as delimited context</text>
        {steps.map(([name, model, note], i) => {
          const x = 32 + i * 132;
          return (
            <g key={name}>
              <rect x={x} y="222" width="120" height="76" rx="6" className={i >= 2 ? "fill-[var(--surface-sunk)] stroke-[var(--rule-strong)]" : box} />
              <text x={x + 10} y="244" className={t}>
                {name}
              </text>
              <text x={x + 10} y="262" className={s}>
                {model}
              </text>
              <text x={x + 10} y="280" className={s}>
                {note.length > 19 ? note.slice(0, 19) : note}
              </text>
              {note.length > 19 && (
                <text x={x + 10} y="292" className={s}>
                  {note.slice(19).trim()}
                </text>
              )}
              {i < steps.length - 1 && <path d={`M${x + 120} 260 H${x + 132}`} className={arrow} markerEnd="url(#arr)" />}
            </g>
          );
        })}
        <text x="296" y="322" className={s}>└─ fanned out per metric, in parallel ─┘</text>
        <text x="32" y="342" className={s}>every model output: streamed → Zod → one repair turn → visible error</text>

        <path d="M624 298 V392" className={arrow} markerEnd="url(#arr)" />
        <text x="16" y="386" className={s}>SUPABASE POSTGRES</text>
        <rect x="16" y="394" width="688" height="62" rx="8" className={box} />
        <text x="32" y="420" className={t}>northwind schema (fictional, seeded)</text>
        <text x="32" y="440" className={s}>role glassbox_reader: SELECT only · read-only txn · 5 s timeout · 1,000 rows</text>
        <text x="476" y="420" className={t}>glassbox_meta</text>
        <text x="476" y="440" className={s}>rate limits via hit() only</text>
      </svg>
      <figcaption className="mt-2 text-sm text-ink-3">The pipeline as built. Shaded steps run once per metric, concurrently, so charts appear as each one finishes.</figcaption>
    </figure>
  );
}
