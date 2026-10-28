import { cn } from "@/lib/cn";
import { diffLines, formatSqlForDisplay, tokenLines, type Token } from "@/lib/sql-tokens";
import { CopyButton } from "./CopyButton";

const tokenClass: Record<Token["kind"], string> = {
  keyword: "text-[var(--syn-keyword)]",
  function: "text-[var(--syn-function)]",
  string: "text-[var(--syn-string)]",
  number: "text-[var(--syn-number)]",
  param: "text-[var(--syn-param)] bg-accent-wash-2 rounded-[2px]",
  comment: "text-[var(--syn-comment)] italic",
  ident: "text-ink",
  punct: "text-ink-2",
  space: "",
};

function Line({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={tokenClass[t.kind]}>
          {t.text}
        </span>
      ))}
    </>
  );
}

/**
 * Syntax-highlighted SQL with line numbers. `:parameters` are tinted with
 * the assumption accent so it's visible which values a chip controls.
 */
export function SQLBlock({
  sql,
  title,
  copy = true,
  maxHeight,
  className,
}: {
  sql: string;
  title?: React.ReactNode;
  copy?: boolean;
  maxHeight?: number;
  className?: string;
}) {
  const lines = tokenLines(formatSqlForDisplay(sql));
  return (
    <figure className={cn("overflow-hidden rounded-md border border-rule bg-sunk", className)}>
      {(title || copy) && (
        <figcaption className="flex h-9 items-center justify-between border-b border-rule pr-1 pl-3">
          <span className="eyebrow">{title ?? "SQL"}</span>
          {copy && <CopyButton text={sql} label="Copy SQL" />}
        </figcaption>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="py-2.5 font-mono text-xs leading-5" tabIndex={0} aria-label="SQL query">
          <code>
            {lines.map((tokens, i) => (
              <div key={i} className="grid grid-cols-[2.75rem_1fr] pr-4">
                <span className="pr-3 text-right text-ink-3/70 select-none" aria-hidden>
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                  <Line tokens={tokens} />
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}

/** Before/after view of a reviewer rewrite. */
export function SqlDiff({ before, after, className }: { before: string; after: string; className?: string }) {
  const lines = diffLines(formatSqlForDisplay(before), formatSqlForDisplay(after));
  const added = lines.filter((l) => l.op === "add").length;
  const removed = lines.filter((l) => l.op === "del").length;
  return (
    <figure className={cn("overflow-hidden rounded-md border border-rule bg-sunk", className)}>
      <figcaption className="flex h-9 items-center justify-between border-b border-rule pr-1 pl-3">
        <span className="eyebrow">
          Reviewer fix <span className="text-pass">+{added}</span> <span className="text-block">−{removed}</span>
        </span>
        <CopyButton text={after} label="Copy fixed SQL" />
      </figcaption>
      <div className="max-h-80 overflow-auto">
        <pre className="py-2 font-mono text-xs leading-5" tabIndex={0} aria-label="Diff between original and reviewed SQL">
          <code>
            {lines.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[1.75rem_1fr] pr-4",
                  l.op === "add" && "bg-pass-wash",
                  l.op === "del" && "bg-block-wash",
                )}
              >
                <span className={cn("text-center select-none", l.op === "add" ? "text-pass" : l.op === "del" ? "text-block" : "text-ink-3/50")}>
                  {l.op === "add" ? "+" : l.op === "del" ? "−" : " "}
                  <span className="sr-only">{l.op === "add" ? "added" : l.op === "del" ? "removed" : ""}</span>
                </span>
                <span className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", l.op === "del" && "text-ink-2 line-through decoration-block/40")}>
                  <Line tokens={tokenLines(l.text)[0] ?? []} />
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
