/**
 * A small SQL tokenizer for syntax highlighting. It only needs to be good
 * enough to color agent-written Postgres; it never decides anything about
 * safety (that's the libpg-query validator's job on the server).
 */
export type TokenKind = "keyword" | "function" | "string" | "number" | "param" | "comment" | "ident" | "punct" | "space";
export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set(
  `select from where and or not in is null as on join left right inner outer full cross group by order having limit offset
  with distinct case when then else end union all intersect except exists between like ilike asc desc nulls first last
  filter over partition rows range preceding following current row interval true false at time zone date timestamp
  timestamptz text int integer numeric boolean bigint lateral using any some cast extract epoch`.split(/\s+/),
);

const RULES: [TokenKind, RegExp][] = [
  ["space", /^\s+/],
  ["comment", /^--[^\n]*/],
  ["comment", /^\/\*[\s\S]*?\*\//],
  ["string", /^'(?:[^']|'')*'?/],
  ["ident", /^"(?:[^"]|"")*"?/],
  ["param", /^:[a-z][a-z0-9_]*/],
  ["punct", /^::/],
  ["number", /^\d+(?:\.\d+)?/],
  ["ident", /^[A-Za-z_][A-Za-z0-9_$]*/],
  ["punct", /^./],
];

export function tokenizeSql(sql: string): Token[] {
  const out: Token[] = [];
  let rest = sql;
  while (rest.length) {
    for (const [kind, re] of RULES) {
      const m = re.exec(rest);
      if (!m) continue;
      let k = kind;
      if (kind === "ident" && !m[0].startsWith('"')) {
        const lower = m[0].toLowerCase();
        if (KEYWORDS.has(lower)) k = "keyword";
        else if (/^\s*\(/.test(rest.slice(m[0].length))) k = "function";
      }
      out.push({ kind: k, text: m[0] });
      rest = rest.slice(m[0].length);
      break;
    }
  }
  return out;
}

/** Splits tokens into lines, cutting multi-line tokens (comments) at newlines. */
export function tokenLines(sql: string): Token[][] {
  const lines: Token[][] = [[]];
  for (const t of tokenizeSql(sql.replace(/\s+$/, ""))) {
    const parts = t.text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1]!.push({ kind: t.kind, text: p });
    });
  }
  return lines;
}

/** Line-level diff (LCS). Small inputs only: agent queries are tens of lines. */
export type DiffLine = { op: "same" | "add" | "del"; text: string };
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a.replace(/\s+$/, "").split("\n");
  const y = b.replace(/\s+$/, "").split("\n");
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  const m = x.length;
  const n = y.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = norm(x[i]!) === norm(y[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (norm(x[i]!) === norm(y[j]!)) {
      out.push({ op: "same", text: y[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ op: "del", text: x[i++]! });
    else out.push({ op: "add", text: y[j++]! });
  }
  while (i < m) out.push({ op: "del", text: x[i++]! });
  while (j < n) out.push({ op: "add", text: y[j++]! });
  return out;
}

/**
 * Inlines bound values as SQL literals, for "copy with values" so a query can
 * be pasted straight into psql. Display/clipboard only: the server never
 * executes SQL built this way.
 */
export function inlineParams(sql: string, params: Record<string, string | number | boolean>): string {
  return tokenizeSql(sql)
    .map((t) => {
      if (t.kind !== "param") return t.text;
      const v = params[t.text.slice(1)];
      if (v === undefined) return t.text;
      return typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v);
    })
    .join("");
}

const CLAUSE = /^(select|from|where|group|order|having|limit|union|join|left|right|inner|full|cross|with)$/i;

/**
 * Display-only formatting for SQL that arrives on one line: breaks before
 * major clauses and indents by parenthesis depth. SQL that already has line
 * structure is returned untouched. Never used for execution or copying.
 */
export function formatSqlForDisplay(sql: string): string {
  if (sql.split("\n").length > 3 || sql.length < 100) return sql;
  const tokens = tokenizeSql(sql);
  let out = "";
  let depth = 0;
  let prevWord = "";
  const nl = () => {
    out = out.replace(/[ \t]+$/, "");
    out += "\n" + "  ".repeat(depth);
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const word = t.kind === "keyword" || t.kind === "ident" ? t.text.toLowerCase() : "";
    if (t.kind === "space") {
      if (!out.endsWith("\n" + "  ".repeat(depth)) && !out.endsWith(" ")) out += " ";
      continue;
    }
    const continuesJoin = word === "join" && /^(left|right|inner|full|cross|outer)$/.test(prevWord);
    const isBy = word === "by" && /^(group|order|partition)$/.test(prevWord);
    if (out && CLAUSE.test(word) && !continuesJoin && !(word === "outer") && !isBy && prevWord !== "(") nl();
    else if (out && (word === "and" || word === "or") && depth <= 1) {
      nl();
      out += "  ";
    }
    if (t.text === "(") depth++;
    if (t.text === ")") {
      depth = Math.max(0, depth - 1);
      // Closing a subquery/CTE body: put the paren on its own line.
      if (/\n\s*\S[^\n]*$/.test(out) && /select/i.test(out.slice(out.lastIndexOf("(")))) nl();
    }
    out += t.text;
    if (t.kind !== "comment") prevWord = word || t.text;
  }
  return out.trim();
}
