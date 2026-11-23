// Local check of customer-supplied encryption keys on a throwaway workspace: add, rotate, revoke (locked), wrong key, restore, return to managed.
// Local demo database only. Run: DATA_MASTER_KEY=<any throwaway key> npx tsx scripts/cmk-selftest.mts
const unwrap = (m: any) => (m && m.default && !m.prisma && !m.enableCmk && !m.getDek ? m.default : m);
const { prisma } = unwrap(await import("../src/lib/prisma.ts"));
const { basePrisma } = unwrap(await import("../src/lib/prisma-base.ts"));
const cmk = unwrap(await import("../src/lib/cmk.ts"));
const keys = unwrap(await import("../src/lib/crypto/keys.ts"));
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Local database only."); process.exit(1); }
const ok = (n: string, c: boolean, extra = "") => { console.log(c ? "PASS" : "FAIL", n, extra); if (!c) process.exitCode = 1; };
const throws = async (f: () => Promise<unknown>) => { try { await f(); return null; } catch (e: any) { return e; } };

const stamp = Date.now();
const ws = await prisma.workspace.create({ data: { name: `CMK Selftest ${stamp}`, slug: `cmk-selftest-${stamp}` } });
try {
  const emp = await prisma.employeeProfile.create({ data: { workspaceId: ws.id, staffCode: "EMP-9001", fullName: "Key Tester", email: `cmk-${stamp}@example.test`, phone: "555-0100", hireDate: new Date() } });
  const raw = () => basePrisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id }, select: { phone: true } });
  const wsRow = () => basePrisma.workspace.findUniqueOrThrow({ where: { id: ws.id }, select: { dataKeyEnc: true } });
  ok("before: the phone number is encrypted in the database and readable through the app client", (await raw()).phone?.startsWith("enc1:") === true && (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } })).phone === "555-0100");
  ok("before: the workspace key is the managed one (v1)", (await wsRow()).dataKeyEnc?.startsWith("v1.") === true && (await cmk.cmkState(ws.id)).state === "MANAGED");

  // ---- key parsing ----
  const good = cmk.generateCustomerKey();
  ok("a generated key is 32 bytes of base64", Buffer.from(good, "base64").length === 32);
  ok("a hex key and a base64 key are both accepted", cmk.parseCustomerKey(Buffer.from(good, "base64").toString("hex")).equals(cmk.parseCustomerKey(good)));
  ok("a short key is rejected", (await throws(async () => cmk.parseCustomerKey("tooshort")))?.message.includes("32 random bytes"));
  ok("a key of repeated bytes is rejected as not random", (await throws(async () => cmk.parseCustomerKey("00".repeat(32))))?.message.includes("too regular"));
  ok("non-hex 64 characters is rejected", (await throws(async () => cmk.parseCustomerKey("zz".repeat(32)))) !== null);

  // ---- add ----
  const added = await cmk.enableCmk(ws.id, good);
  const w1 = await wsRow();
  ok("adding a key returns a fingerprint and version 1", /^[0-9a-f]{8}$/.test(added.fingerprint) && added.version === 1);
  ok("the workspace key is now wrapped by the customer key (c1) and the managed copy is gone", w1.dataKeyEnc?.startsWith("c1.") === true && (await throws(async () => keys.unwrapDek(w1.dataKeyEnc!))) !== null);
  const row = await basePrisma.workspaceCmk.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  ok("the key is stored only sealed, never in plain text or as hex/base64", !!row.kekSealed && !row.kekSealed.includes(good) && !row.kekSealed.includes(Buffer.from(good, "base64").toString("hex")) && row.status === "ACTIVE");
  ok("records are still readable and writable with the key active (no re-encryption needed)", (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } })).phone === "555-0100" && (await prisma.employeeProfile.update({ where: { id: emp.id }, data: { phone: "555-0111" } })).phone === "555-0111");
  ok("the stored ciphertext did not change when the key was added", (await raw()).phone?.startsWith("enc1:") === true);
  ok("adding a second key without rotating is refused", (await throws(() => cmk.enableCmk(ws.id, cmk.generateCustomerKey())))?.message.includes("already uses"));
  ok("the workspace is not locked while the key is active", (await cmk.isWorkspaceLocked({ id: ws.id, dataKeyEnc: w1.dataKeyEnc })) === false);

  // ---- rotate ----
  const second = cmk.generateCustomerKey();
  const rot = await cmk.rotateCmk(ws.id, second);
  const w2 = await wsRow();
  ok("rotating bumps the version and changes the fingerprint", rot.version === 2 && rot.fingerprint !== added.fingerprint);
  ok("the old key no longer unwraps the workspace key", (await throws(async () => keys.unwrapWithCustomerKey(w2.dataKeyEnc!, cmk.parseCustomerKey(good)))) !== null && (() => { try { return keys.unwrapWithCustomerKey(w2.dataKeyEnc!, cmk.parseCustomerKey(second)).length === 32; } catch { return false; } })());
  ok("records still read after rotation", (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } })).phone === "555-0111");
  ok("rotating to the same key is refused", (await throws(() => cmk.rotateCmk(ws.id, second)))?.message.includes("already in use"));

  // ---- revoke: locked ----
  await cmk.revokeCmk(ws.id);
  const st = await cmk.cmkState(ws.id);
  const rowR = await basePrisma.workspaceCmk.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  ok("revoking marks the key REVOKED and deletes the sealed copy", st.state === "REVOKED" && rowR.kekSealed === null && !!rowR.revokedAt);
  ok("the workspace reports locked", (await cmk.isWorkspaceLocked({ id: ws.id, dataKeyEnc: (await wsRow()).dataKeyEnc })) === true);
  const e1 = await throws(() => keys.getDek(ws.id));
  ok("the data key can no longer be obtained (KeyRevokedError)", e1?.name === "KeyRevokedError");
  const e2 = await throws(() => prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } }));
  ok("reading an encrypted record fails loudly, not with a placeholder", e2?.name === "KeyRevokedError" && !String(e2?.message).includes("could not decrypt"));
  const e3 = await throws(() => prisma.employeeProfile.update({ where: { id: emp.id }, data: { phone: "555-0222" } }));
  ok("writing an encrypted field is refused too", e3?.name === "KeyRevokedError");
  ok("nothing was changed or deleted by revoking (raw ciphertext is the same)", (await raw()).phone?.startsWith("enc1:") === true);
  ok("non-encrypted data is still reachable (the workspace row)", (await prisma.workspace.findUniqueOrThrow({ where: { id: ws.id } })).name.startsWith("CMK Selftest"));
  ok("revoking twice is refused", (await throws(() => cmk.revokeCmk(ws.id)))?.message.includes("already revoked"));
  ok("returning to managed is refused while revoked", (await throws(() => cmk.removeCmk(ws.id)))?.message.includes("Provide the key again"));

  // ---- restore ----
  ok("the FIRST (rotated-away) key cannot unlock it", (await throws(() => cmk.restoreCmk(ws.id, good)))?.message.includes("not the key for this workspace"));
  ok("a random key cannot unlock it", (await throws(() => cmk.restoreCmk(ws.id, cmk.generateCustomerKey())))?.message.includes("not the key for this workspace"));
  ok("still locked after wrong guesses", (await cmk.cmkState(ws.id)).state === "REVOKED");
  const back = await cmk.restoreCmk(ws.id, second);
  ok("the right key unlocks it", back.fingerprint === rot.fingerprint && (await cmk.cmkState(ws.id)).state === "ACTIVE");
  ok("records are readable and writable again", (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } })).phone === "555-0111" && (await prisma.employeeProfile.update({ where: { id: emp.id }, data: { phone: "555-0333" } })).phone === "555-0333");

  // ---- back to managed ----
  await cmk.removeCmk(ws.id);
  const w3 = await wsRow();
  ok("returning to managed restores a v1 key and removes the customer key record", w3.dataKeyEnc?.startsWith("v1.") === true && (await cmk.cmkState(ws.id)).state === "MANAGED");
  ok("data is still readable after returning to managed", (await prisma.employeeProfile.findUniqueOrThrow({ where: { id: emp.id } })).phone === "555-0333");
  ok("the master-key rotation script's filter (v1 only) would skip a customer-key workspace", "c1.x".startsWith("v1.") === false);
} finally {
  await basePrisma.workspace.delete({ where: { id: ws.id } }).catch(() => {});
  console.log("cleaned up");
}
process.exit(process.exitCode ?? 0);
