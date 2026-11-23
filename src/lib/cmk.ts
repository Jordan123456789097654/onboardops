import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { basePrisma } from "./prisma-base";
import { forgetDek, getDek, isCustomerWrapped, unwrapWithCustomerKey, wrapDek, wrapWithCustomerKey, unwrapDek } from "./crypto/keys";
import { open, seal } from "./secret-box";

/**
 * Customer-supplied encryption key. The owner provides a 256-bit key. It wraps the workspace data key, and the data key stays the same,
 * so adding, rotating or removing a customer key never re-encrypts any record. While the key is active a sealed copy is kept so the app can
 * work; revoking deletes that copy, which locks the workspace's encrypted records until the owner provides the key again.
 */

export type CmkState = { state: "MANAGED" } | { state: "ACTIVE" | "REVOKED"; version: number; fingerprint: string; addedAt: Date; rotatedAt: Date | null; revokedAt: Date | null };

export const generateCustomerKey = () => randomBytes(32).toString("base64");

/** Accepts 64 hex characters or base64 of 32 bytes. Rejects anything weak. */
export function parseCustomerKey(input: string): Buffer {
  const t = input.trim();
  let key: Buffer | null = null;
  if (/^[a-f0-9]{64}$/i.test(t)) key = Buffer.from(t, "hex");
  else if (/^[A-Za-z0-9+/_-]{43}={0,1}$/.test(t)) { const b = Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64"); if (b.length === 32) key = b; }
  if (!key) throw new Error("The key must be 32 random bytes written as 64 hex characters or as base64 (44 characters).");
  if (new Set(key).size < 12) throw new Error("That key is too regular to be random. Generate a new one.");
  return key;
}

export const keyFingerprint = (key: Buffer) => createHash("sha256").update(Buffer.concat([Buffer.from("cmk-fp:"), key])).digest("hex").slice(0, 8);

export async function cmkState(workspaceId: string): Promise<CmkState> {
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
  if (!c) return { state: "MANAGED" };
  return { state: c.status === "ACTIVE" ? "ACTIVE" : "REVOKED", version: c.keyVersion, fingerprint: c.fingerprint, addedAt: c.addedAt, rotatedAt: c.rotatedAt, revokedAt: c.revokedAt };
}

/** True when the workspace uses a customer key that is currently revoked or missing. */
export async function isWorkspaceLocked(workspace: { id: string; dataKeyEnc: string | null }): Promise<boolean> {
  if (!isCustomerWrapped(workspace.dataKeyEnc)) return false;
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId: workspace.id }, select: { status: true, kekSealed: true } });
  return !c || c.status !== "ACTIVE" || !c.kekSealed;
}

async function currentRow(workspaceId: string) {
  const w = await basePrisma.workspace.findUnique({ where: { id: workspaceId }, select: { dataKeyEnc: true } });
  if (!w) throw new Error("Workspace not found.");
  return w;
}

/** Starts using a customer key. The workspace data key is wrapped with it and the managed copy is replaced. */
export async function enableCmk(workspaceId: string, keyInput: string) {
  const key = parseCustomerKey(keyInput);
  if (await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } })) throw new Error("This workspace already uses a customer key. Rotate it instead.");
  const dek = await getDek(workspaceId); // creates the managed key first if the workspace never needed one
  const wrapped = wrapWithCustomerKey(dek, key);
  await basePrisma.$transaction([
    basePrisma.workspace.update({ where: { id: workspaceId }, data: { dataKeyEnc: wrapped } }),
    basePrisma.workspaceCmk.create({ data: { workspaceId, status: "ACTIVE", keyVersion: 1, fingerprint: keyFingerprint(key), kekSealed: seal(key.toString("base64")) } }),
  ]);
  forgetDek(workspaceId);
  return { fingerprint: keyFingerprint(key), version: 1 };
}

/** Replaces the customer key with a new one. The data key is re-wrapped; no record is touched. */
export async function rotateCmk(workspaceId: string, newKeyInput: string) {
  const next = parseCustomerKey(newKeyInput);
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
  if (!c || c.status !== "ACTIVE" || !c.kekSealed) throw new Error("There is no active customer key to rotate.");
  if (keyFingerprint(next) === c.fingerprint) throw new Error("That is the key already in use. Provide a different key.");
  const w = await currentRow(workspaceId);
  const old = open(c.kekSealed);
  if (!old) throw new Error("The stored key could not be read.");
  const dek = unwrapWithCustomerKey(w.dataKeyEnc!, Buffer.from(old, "base64"));
  await basePrisma.$transaction([
    basePrisma.workspace.update({ where: { id: workspaceId }, data: { dataKeyEnc: wrapWithCustomerKey(dek, next) } }),
    basePrisma.workspaceCmk.update({ where: { workspaceId }, data: { keyVersion: { increment: 1 }, fingerprint: keyFingerprint(next), kekSealed: seal(next.toString("base64")), rotatedAt: new Date() } }),
  ]);
  forgetDek(workspaceId);
  return { fingerprint: keyFingerprint(next), version: c.keyVersion + 1 };
}

/** Locks the workspace. Our sealed copy of the key is deleted, so the data key can no longer be unwrapped by us. */
export async function revokeCmk(workspaceId: string) {
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
  if (!c) throw new Error("This workspace does not use a customer key.");
  if (c.status === "REVOKED") throw new Error("The key is already revoked.");
  await basePrisma.workspaceCmk.update({ where: { workspaceId }, data: { status: "REVOKED", kekSealed: null, revokedAt: new Date() } });
  forgetDek(workspaceId);
}

/** Unlocks a revoked workspace by providing the key again. Succeeds only if it is the key that wraps the data key. */
export async function restoreCmk(workspaceId: string, keyInput: string) {
  const key = parseCustomerKey(keyInput);
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
  if (!c) throw new Error("This workspace does not use a customer key.");
  if (c.status === "ACTIVE") throw new Error("The key is already active.");
  const w = await currentRow(workspaceId);
  try { unwrapWithCustomerKey(w.dataKeyEnc!, key); } catch { throw new Error("That is not the key for this workspace."); }
  await basePrisma.workspaceCmk.update({ where: { workspaceId }, data: { status: "ACTIVE", kekSealed: seal(key.toString("base64")), revokedAt: null } });
  forgetDek(workspaceId);
  return { fingerprint: keyFingerprint(key), version: c.keyVersion };
}

/** Goes back to the OnboardOps-managed key. Only while the customer key is active (we need it to unwrap the data key). */
export async function removeCmk(workspaceId: string) {
  const c = await basePrisma.workspaceCmk.findUnique({ where: { workspaceId } });
  if (!c) throw new Error("This workspace does not use a customer key.");
  if (c.status !== "ACTIVE") throw new Error("Provide the key again first, then you can return to the managed key.");
  const dek = await getDek(workspaceId);
  await basePrisma.$transaction([
    basePrisma.workspace.update({ where: { id: workspaceId }, data: { dataKeyEnc: wrapDek(dek) } }),
    basePrisma.workspaceCmk.delete({ where: { workspaceId } }),
  ]);
  forgetDek(workspaceId);
}

// Kept so a test can confirm the managed path still unwraps after returning to it.
export const _unwrapManaged = unwrapDek;
export { prisma as _prisma };
