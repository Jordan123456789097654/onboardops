import { Prisma } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { deepDecrypt, encryptBytes, encryptJson, encryptString, isEncryptedBytes, isEncryptedJson, isEncryptedString } from "./fields";

/** Which columns are encrypted before they reach the database. s = text, j = JSON, b = file bytes. */
export const FIELDS: Record<string, Record<string, "s" | "j" | "b">> = {
  InfractionCase: { summary: "s", confidentialManagerNotes: "s" },
  InfractionTimelineEvent: { note: "s" },
  CaseAttachment: { statement: "s" },
  Appeal: { reason: "s", decisionNote: "s" },
  IncidentReport: { description: "s", reviewerNotes: "s", rootCause: "s", injury: "j", actions: "j", workersComp: "j" },
  InvestigationCase: { summary: "s", findings: "s" },
  InvestigationEntry: { content: "s" },
  CoachingNote: { note: "s" },
  Review: { summary: "s", strengths: "s", improvements: "s", goals: "s", privateNotes: "s" },
  EmployeeProfile: { phone: "s", emergencyContact: "s", customValues: "j" },
  StaffRequest: { reason: "s", decisionNote: "s" },
  ProfileChangeRequest: { changes: "j" },
  Credential: { number: "s" },
  Notification: { body: "s" },
  HandoffNote: { body: "s" },
  StoredFile: { data: "b" },
};

/** Models that have no workspaceId of their own: find it through the case they belong to. */
const PARENT: Record<string, { fk: string; parent: string }> = {
  InfractionTimelineEvent: { fk: "caseId", parent: "InfractionCase" },
  CaseAttachment: { fk: "caseId", parent: "InfractionCase" },
  InvestigationEntry: { fk: "investigationId", parent: "InvestigationCase" },
};
/** Nested writes (create inside a create) for relations that contain encrypted columns. */
const NESTED: Record<string, Record<string, string>> = {
  InfractionCase: { timeline: "InfractionTimelineEvent", attachments: "CaseAttachment", appeals: "Appeal" },
  InvestigationCase: { entries: "InvestigationEntry" },
};

const WRITES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert"]);
const lower = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function wsFromRecord(model: string, where: Any): Promise<string | null> {
  const p = PARENT[model];
  const delegate = (basePrisma as Any)[lower(model)];
  if (p) {
    const r = await delegate.findFirst({ where, select: { [p.fk]: true } });
    return r ? wsFromParent(p.parent, r[p.fk]) : null;
  }
  const r = await delegate.findFirst({ where, select: { workspaceId: true } });
  return r?.workspaceId ?? null;
}
/**
 * Cases created moments ago inside a still-open transaction cannot be found by a lookup that runs outside that transaction,
 * so the workspace of each case this process creates is remembered briefly. Without it, adding a timeline note to a brand-new case failed.
 */
const justCreated = new Map<string, string>();
function rememberCase(id: string, ws: string) {
  justCreated.set(id, ws);
  if (justCreated.size > 500) justCreated.delete(justCreated.keys().next().value as string);
}

async function wsFromParent(parent: string, id: string): Promise<string | null> {
  if (parent === "InfractionCase" || parent === "InvestigationCase") { const known = justCreated.get(`${parent}:${id}`); if (known) return known; }
  const r = await (basePrisma as Any)[lower(parent)].findUnique({ where: { id }, select: { workspaceId: true } });
  return r?.workspaceId ?? null;
}

const hasTargets = (model: string, data: Any): boolean => {
  if (!data || typeof data !== "object") return false;
  const f = FIELDS[model] ?? {};
  return Object.keys(data).some((k) => f[k] || (NESTED[model]?.[k] && true));
};

async function encValue(kind: "s" | "j" | "b", ws: string, raw: Any): Promise<Any> {
  if (raw === null || raw === undefined) return raw;
  if (kind === "s") return typeof raw === "string" && raw !== "" && !isEncryptedString(raw) ? encryptString(ws, raw) : raw;
  if (kind === "j") return isEncryptedJson(raw) || (typeof raw === "object" && raw !== null && "toString" in raw && (raw as Any).constructor?.name === "NullTypes") ? raw : encryptJson(ws, raw);
  return Buffer.isBuffer(raw) && !isEncryptedBytes(raw) ? encryptBytes(ws, raw) : raw;
}

/** Encrypts the target fields of one `data` object, and any nested child writes. ws may be unknown until a field needs it. */
async function encData(model: string, data: Any, knownWs: string | null, resolve?: () => Promise<string | null>): Promise<Any> {
  if (!data || typeof data !== "object") return data;
  const fields = FIELDS[model] ?? {};
  let ws = knownWs ?? (typeof data.workspaceId === "string" ? data.workspaceId : null);
  const p = PARENT[model];
  const getWs = async () => {
    if (ws) return ws;
    if (p && typeof data[p.fk] === "string") ws = await wsFromParent(p.parent, data[p.fk]);
    if (!ws && resolve) ws = await resolve();
    return ws;
  };
  const out: Any = { ...data };
  for (const key of Object.keys(data)) {
    const v = data[key];
    const kind = fields[key];
    if (kind) {
      const wrapped = v && typeof v === "object" && !Buffer.isBuffer(v) && !Array.isArray(v) && "set" in v;
      const raw = wrapped ? v.set : v;
      if (raw === null || raw === undefined) continue;
      const id = await getWs();
      if (!id) throw new Error(`Cannot encrypt ${model}.${key}: the workspace is unknown.`);
      const enc = await encValue(kind, id, raw);
      out[key] = wrapped ? { ...v, set: enc } : enc;
    } else if (NESTED[model]?.[key] && v && typeof v === "object") {
      const child = NESTED[model][key];
      const id = await getWs();
      const each = async (x: Any) => (Array.isArray(x) ? Promise.all(x.map((y) => encData(child, y, id))) : encData(child, x, id));
      const n: Any = { ...v };
      if (n.create) n.create = await each(n.create);
      if (n.createMany?.data) n.createMany = { ...n.createMany, data: await each(n.createMany.data) };
      if (n.update) n.update = Array.isArray(n.update) ? await Promise.all(n.update.map(async (u: Any) => ({ ...u, data: await encData(child, u.data, id) }))) : { ...n.update, data: await encData(child, n.update.data ?? n.update, id) };
      if (n.upsert) n.upsert = Array.isArray(n.upsert) ? n.upsert : { ...n.upsert, create: await encData(child, n.upsert.create, id), update: await encData(child, n.upsert.update, id) };
      out[key] = n;
    }
  }
  return out;
}

export const encryptionExtension = Prisma.defineExtension({
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: Any) {
        let a = args;
        if (WRITES.has(operation) && (FIELDS[model] || NESTED[model])) {
          const resolve = () => wsFromRecord(model, a.where);
          if (operation === "create" || operation === "createManyAndReturn") {
            a = { ...a, data: Array.isArray(a.data) ? await Promise.all(a.data.map((d: Any) => encData(model, d, null))) : await encData(model, a.data, null) };
          } else if (operation === "createMany") {
            a = { ...a, data: Array.isArray(a.data) ? await Promise.all(a.data.map((d: Any) => encData(model, d, null))) : await encData(model, a.data, null) };
          } else if (operation === "update" || operation === "updateMany") {
            if (hasTargets(model, a.data)) a = { ...a, data: await encData(model, a.data, null, resolve) };
          } else if (operation === "upsert") {
            a = { ...a, create: await encData(model, a.create, null), update: hasTargets(model, a.update) ? await encData(model, a.update, null, resolve) : a.update };
          }
        }
        const result = await query(a);
        if ((model === "InfractionCase" || model === "InvestigationCase") && operation === "create" && result && typeof result === "object" && typeof (result as Any).id === "string" && typeof (result as Any).workspaceId === "string") rememberCase(`${model}:${(result as Any).id}`, (result as Any).workspaceId);
        return deepDecrypt(result);
      },
    },
  },
});
