import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Loads .env.local for scripts (Next.js does this itself for the app). */
export function loadEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return v;
}

/** Sets KEY=value in .env.local, replacing an existing line. */
export function writeEnvVar(name: string, value: string): void {
  const path = ".env.local";
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  writeFileSync(path, lines.join("\n"), { mode: 0o600 });
  process.env[name] = value;
}
