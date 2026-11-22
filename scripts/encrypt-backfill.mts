// Encrypts existing plain-text rows in the sensitive columns. Safe to run more than once: encrypted values are skipped.
// Usage:  npx tsx scripts/encrypt-backfill.mts [--dry]
// Needs DATABASE_URL and DATA_MASTER_KEY in the environment.
import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = (m: any) => (m && m.default && !m.FIELDS && !m.encryptString ? m.default : m);
const { FIELDS } = unwrap(await import("../src/lib/crypto/extension.ts"));
const { encryptString, encryptJson, encryptBytes, isEncryptedString, isEncryptedJson, isEncryptedBytes } = unwrap(await import("../src/lib/crypto/fields.ts"));

const dry = process.argv.includes("--dry");
const raw = new PrismaClient();
const PARENT: Record<string, string> = { InfractionTimelineEvent: "caseId", CaseAttachment: "caseId" };
const lower = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let total = 0;
for (const [model, fields] of Object.entries(FIELDS as Record<string, Record<string, "s" | "j" | "b">>)) {
  const delegate: Any = (raw as Any)[lower(model)];
  const select: Any = { id: true, ...Object.fromEntries(Object.keys(fields).map((f) => [f, true])), ...(PARENT[model] ? { [PARENT[model]]: true } : { workspaceId: true }) };
  let cursor: string | undefined;
  let changed = 0, scanned = 0;
  for (;;) {
    const rows: Any[] = await delegate.findMany({ select, orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    let wsOf = (r: Any): string | null => r.workspaceId ?? null;
    if (PARENT[model]) {
      const cases: Any[] = await (raw as Any).infractionCase.findMany({ where: { id: { in: [...new Set(rows.map((r) => r[PARENT[model]]))] } }, select: { id: true, workspaceId: true } });
      const m = new Map(cases.map((c) => [c.id, c.workspaceId]));
      wsOf = (r) => m.get(r[PARENT[model]]) ?? null;
    }
    for (const r of rows) {
      scanned++;
      const ws = wsOf(r);
      if (!ws) continue;
      const data: Any = {};
      for (const [f, kind] of Object.entries(fields)) {
        const v = r[f];
        if (v === null || v === undefined) continue;
        if (kind === "s" && typeof v === "string" && v !== "" && !isEncryptedString(v)) data[f] = await encryptString(ws, v);
        else if (kind === "j" && !isEncryptedJson(v) && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) data[f] = await encryptJson(ws, v);
        else if (kind === "b" && Buffer.isBuffer(v) && !isEncryptedBytes(v)) data[f] = await encryptBytes(ws, v);
      }
      if (Object.keys(data).length) { changed++; if (!dry) await delegate.update({ where: { id: r.id }, data }); }
    }
  }
  total += changed;
  console.log(`${model}: ${changed} of ${scanned} rows ${dry ? "would be " : ""}encrypted`);
}
console.log(`${dry ? "Dry run. " : ""}Done. ${total} rows ${dry ? "need" : "were"} encrypting.`);
await raw.$disconnect();
