import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.production.local");
const raw = readFileSync(envPath, "utf8");
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const i = trimmed.indexOf("=");
  if (i <= 0) continue;
  const key = trimmed.slice(0, i);
  let val = trimmed.slice(i + 1);
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const sqlPath = resolve(process.cwd(), "prisma/sql/2026_ledger_nfe.sql");
const result = spawnSync(
  "npx",
  ["prisma", "db", "execute", "--file", sqlPath, "--schema", "prisma/schema.prisma"],
  { stdio: "inherit", env: process.env, shell: true }
);
process.exit(result.status ?? 1);
