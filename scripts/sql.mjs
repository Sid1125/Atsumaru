#!/usr/bin/env node
/**
 * Runs SQL against the Supabase project through the Management API.
 * Local dev helper — gitignored, never committed (it reads the token from the env).
 *
 *   node scripts/sql.mjs -f path/to/file.sql
 *   node scripts/sql.mjs -c "select 1"
 */
import { readFileSync } from "node:fs";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.");
  process.exit(1);
}

const args = process.argv.slice(2);
const fileIdx = args.indexOf("-f");
const cmdIdx = args.indexOf("-c");

let query;
if (fileIdx !== -1) query = readFileSync(args[fileIdx + 1], "utf8");
else if (cmdIdx !== -1) query = args[cmdIdx + 1];
else {
  console.error("Pass -f <file.sql> or -c <sql>.");
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  }
);

const text = await res.text();

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}

try {
  const rows = JSON.parse(text);
  console.log(rows.length === 0 ? "(no rows)" : JSON.stringify(rows, null, 2));
} catch {
  console.log(text);
}
