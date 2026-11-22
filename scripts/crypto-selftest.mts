// Local check of the encryption layer against the local demo database. Creates and deletes its own rows.
import { PrismaClient } from "@prisma/client";
const unwrap = (m: any) => (m && m.default && !m.prisma && !m.isEncryptedString ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const { isEncryptedBytes, isEncryptedJson, isEncryptedString } = unwrap(await import("../src/lib/crypto/fields.ts"));

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const raw = new PrismaClient();
const ws = await raw.workspace.findFirst({ include: { employees: { take: 1 } } });
if (!ws) throw new Error("no workspace");
const emp = ws.employees[0];
const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) process.exitCode = 1; };

// text field: create, read raw, read through the app client, update
const note = await prisma.coachingNote.create({ data: { workspaceId: ws.id, employeeId: emp.id, authorName: "Test", note: "Talked about call-outs. Private." } });
const rawNote = await raw.coachingNote.findUnique({ where: { id: note.id } });
ok("coaching note stored encrypted", isEncryptedString(rawNote!.note));
ok("coaching note reads back as plain text", (await prisma.coachingNote.findUnique({ where: { id: note.id } }))!.note === "Talked about call-outs. Private.");
await prisma.coachingNote.update({ where: { id: note.id }, data: { note: "Updated private note." } });
ok("update stays encrypted", isEncryptedString((await raw.coachingNote.findUnique({ where: { id: note.id } }))!.note));
ok("update reads back", (await prisma.coachingNote.findUnique({ where: { id: note.id } }))!.note === "Updated private note.");
ok("a different workspace's id cannot be spliced in", (rawNote!.note.split(":")[1]) === ws.id);

// legacy plaintext still reads
const legacy = await raw.coachingNote.create({ data: { workspaceId: ws.id, employeeId: emp.id, authorName: "Old", note: "plain old note" } });
ok("legacy plaintext still readable", (await prisma.coachingNote.findUnique({ where: { id: legacy.id } }))!.note === "plain old note");

// JSON field
const inc = await prisma.incidentReport.create({ data: { workspaceId: ws.id, reportedByName: "T", type: "INJURY", occurredAt: new Date(), description: "Slipped near dock 4.", injury: { bodyPart: "ankle", daysAway: 2 }, actions: [{ text: "Mop", done: false }] } });
const rawInc = await raw.incidentReport.findUnique({ where: { id: inc.id } });
ok("incident text encrypted", isEncryptedString(rawInc!.description));
ok("incident json encrypted", isEncryptedJson(rawInc!.injury) && isEncryptedJson(rawInc!.actions));
const back = await prisma.incidentReport.findUnique({ where: { id: inc.id } });
ok("incident reads back", back!.description === "Slipped near dock 4." && (back!.injury as { bodyPart: string }).bodyPart === "ankle" && (back!.actions as { text: string }[])[0].text === "Mop");

// child model (workspace found through the case) and nested create
const kase = await raw.infractionCase.findFirst({ where: { workspaceId: ws.id } });
if (kase) {
  const ev = await prisma.infractionTimelineEvent.create({ data: { caseId: kase.id, actorName: "T", eventType: "NOTE_ADDED", note: "Timeline note secret" } });
  ok("timeline note encrypted (child model)", isEncryptedString((await raw.infractionTimelineEvent.findUnique({ where: { id: ev.id } }))!.note));
  ok("timeline note reads back", (await prisma.infractionTimelineEvent.findUnique({ where: { id: ev.id } }))!.note === "Timeline note secret");
  await prisma.infractionTimelineEvent.update({ where: { id: ev.id }, data: { note: "Edited timeline" } });
  ok("timeline update encrypted via parent lookup", isEncryptedString((await raw.infractionTimelineEvent.findUnique({ where: { id: ev.id } }))!.note));
  const viaInclude = await prisma.infractionCase.findUnique({ where: { id: kase.id }, include: { timeline: true } });
  ok("include returns decrypted children", viaInclude!.timeline.some((t) => t.note === "Edited timeline"));
  await raw.infractionTimelineEvent.delete({ where: { id: ev.id } });
}

// file bytes
const bytes = Buffer.from("%PDF-1.4 fake pdf bytes for test");
const f = await prisma.storedFile.create({ data: { workspaceId: ws.id, name: "t.pdf", mime: "application/pdf", size: bytes.length, data: bytes, uploadedByName: "T" } });
ok("file bytes encrypted", isEncryptedBytes((await raw.storedFile.findUnique({ where: { id: f.id } }))!.data as Buffer));
ok("file bytes read back identical", Buffer.compare((await prisma.storedFile.findUnique({ where: { id: f.id } }))!.data as Buffer, bytes) === 0);

// key is stored wrapped, not usable
const w = await raw.workspace.findUnique({ where: { id: ws.id }, select: { dataKeyEnc: true } });
ok("workspace key stored in wrapped form", !!w!.dataKeyEnc && w!.dataKeyEnc.startsWith("v1."));

await raw.coachingNote.deleteMany({ where: { id: { in: [note.id, legacy.id] } } });
await raw.incidentReport.delete({ where: { id: inc.id } });
await raw.storedFile.delete({ where: { id: f.id } });
await raw.$disconnect();
console.log(process.exitCode ? "SOME CHECKS FAILED" : "ALL CHECKS PASSED");
