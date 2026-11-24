/**
 * Finds database queries on workspace-scoped tables that do not mention the workspace. In a multi-tenant app, one forgotten
 * workspace filter lets one customer read another's data. This is a heuristic (it reads the code, it does not run it), so
 * every hit needs a human look, but it catches the common mistake.
 *
 *   npx tsx scripts/check-scoping.mts            list findings
 *   npx tsx scripts/check-scoping.mts --strict   exit 1 if any HIGH finding exists (for CI)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

const scoped = new Set<string>();
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) if (/^\s+workspaceId\s/m.test(m[2])) scoped.add(m[1][0].toLowerCase() + m[1].slice(1));

// Staff-console and platform code reads across workspaces on purpose.
const CROSS_TENANT = [/^src[\\/]app[\\/]admin/, /^src[\\/]actions[\\/]admin/, /^src[\\/]actions[\\/]support/, /^src[\\/]actions[\\/]chat-support/, /^src[\\/]actions[\\/]help-feedback/, /^src[\\/]lib[\\/]support/, /^src[\\/]lib[\\/]growth/, /^src[\\/]lib[\\/]platform/, /^src[\\/]lib[\\/]maintenance/, /^src[\\/]lib[\\/]jobs/, /^src[\\/]app[\\/]api[\\/]support/, /^src[\\/]app[\\/]api[\\/]cron/, /^src[\\/]app[\\/]api[\\/]admin/, /^src[\\/]lib[\\/]scim/, /^src[\\/]lib[\\/]crypto/, /^src[\\/]lib[\\/]incidents/, /^src[\\/]actions[\\/]waitlist/, /^src[\\/]lib[\\/]automations/, /^src[\\/]lib[\\/]status/];

const LIST_OPS = new Set(["findMany", "findFirst", "count", "groupBy", "aggregate", "updateMany", "deleteMany"]);
const ID_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert", "findFirstOrThrow"]);

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "node_modules" || f === ".next") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

function argsAt(src: string, open: number): string {
  let depth = 0, i = open, q = "";
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

type Finding = { file: string; line: number; model: string; op: string; level: "HIGH" | "CHECK"; snippet: string };
const findings: Finding[] = [];
let scanned = 0;
let self = 0;
for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file);
  if (CROSS_TENANT.some((re) => re.test(rel))) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\b(?:prisma|tx|db)\.(\w+)\.(\w+)\(/g)) {
    const [, model, op] = m;
    if (!scoped.has(model) || !(LIST_OPS.has(op) || ID_OPS.has(op))) continue;
    scanned++;
    const args = argsAt(src, m.index! + m[0].length - 1);
    if (/workspaceId|workspace\s*:|workspace_/i.test(args)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    const lines = src.split("\n");
    // `{ where, ... }` where the variable was built with a workspace filter a few lines earlier.
    if (/\bwhere\b(?!\s*:)/.test(args) && /where[^\n]*workspaceId|workspaceId[^\n]*where/.test(lines.slice(Math.max(0, line - 25), line).join("\n"))) continue;
    if (/scoping-ok/.test(lines.slice(Math.max(0, line - 2), line).join("\n"))) continue;
    // Scoped to the signed-in person's own identity (my requests, my notifications): can't reach another customer's rows.
    if (/(employeeId|memberId|userId|completedByEmployeeId|reporterEmployeeId)\s*:\s*(\{ in:|\w+(\.\w+|!)*\.(id|userId))/.test(args)) { self++; continue; }
    findings.push({ file: rel, line, model, op, level: LIST_OPS.has(op) ? "HIGH" : "CHECK", snippet: args.replace(/\s+/g, " ").slice(0, 110) });
  }
}

const high = findings.filter((f) => f.level === "HIGH");
const check = findings.filter((f) => f.level === "CHECK");
console.log(`Scoped models: ${scoped.size}. Queries examined: ${scanned}. Scoped to the caller's own identity: ${self}. Without a workspace filter: ${high.length} list/bulk (HIGH), ${check.length} by-id (CHECK).\n`);
console.log("HIGH: list, count or bulk queries with no workspace filter. Each should be scoped, or have a comment saying why not.");
for (const f of high) console.log(`  ${f.file}:${f.line}  ${f.model}.${f.op}(${f.snippet})`);
console.log("\nCHECK: queries by id. Safe only if the id was already proven to belong to this workspace. Count by file:");
const byFile = new Map<string, number>();
for (const f of check) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}  ${f}`);
if (process.argv.includes("--strict") && high.length) process.exit(1);
