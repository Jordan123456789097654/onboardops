// Re-locks every workspace's data key with a new master key. No data is re-encrypted, so this is fast.
// Usage:  DATA_MASTER_KEY=<new> DATA_MASTER_KEY_OLD=<old> npx tsx scripts/rotate-master-key.mts
// After it finishes, remove DATA_MASTER_KEY_OLD from the environment.
import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapMod = (m: any) => (m && m.default && !m.wrapDek ? m.default : m);
const { wrapDek, unwrapDek } = unwrapMod(await import("../src/lib/crypto/keys.ts"));
if (!process.env.DATA_MASTER_KEY || !process.env.DATA_MASTER_KEY_OLD) { console.error("Set both DATA_MASTER_KEY (new) and DATA_MASTER_KEY_OLD (current)."); process.exit(1); }
const raw = new PrismaClient();
const rows = await raw.workspace.findMany({ where: { dataKeyEnc: { startsWith: "v1." } }, select: { id: true, dataKeyEnc: true } });
let n = 0;
for (const w of rows) { await raw.workspace.update({ where: { id: w.id }, data: { dataKeyEnc: wrapDek(unwrapDek(w.dataKeyEnc!)) } }); n++; }
console.log(`Re-locked ${n} workspace keys with the new master key.`);
await raw.$disconnect();
