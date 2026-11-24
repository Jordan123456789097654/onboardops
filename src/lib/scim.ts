import { createHash, randomBytes, randomInt } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { EmployeeStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { writeAudit } from "./audit";
import { isWorkspaceLocked } from "./cmk";
import { getMaintenanceCached } from "./maintenance";
import { hit } from "./rate-limit";

export const SCIM_CONTENT_TYPE = "application/scim+json";

export const SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_SCHEMA_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const SCIM_SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_SCHEMA_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_SCHEMA_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SCIM_SCHEMA_SP_CONFIG = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";

const MAX_SCIM_BODY_BYTES = 256 * 1024;
const EMAIL_CHECK = z.string().trim().email().max(254);

export type ScimAuthContext = {
  workspaceId: string;
  tokenId: string;
  scopes: string[];
};

export type ScimMemberRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  };
  profile: {
    id: string;
    staffCode: string;
    fullName: string;
    email: string;
    status: EmployeeStatus;
    customValues?: unknown;
    jobRole?: { id?: string; title: string } | null;
    department?: { id: string; name: string } | null;
  } | null;
};

export type ScimGroupDepartment = {
  id: string;
  workspaceId: string;
  name: string;
};

export type ScimGroupMemberInput = {
  id: string;
  memberId?: string | null;
  fullName?: string;
  display?: string;
  user?: { name: string } | null;
  profile?: { fullName: string } | null;
};

export class ScimHttpError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public scimType?: string
  ) {
    super(detail);
    this.name = "ScimHttpError";
  }
}

export function scimJson(body: unknown, status = 200, extraHeaders?: Record<string, string>): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": SCIM_CONTENT_TYPE,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function scimError(detail: string, status = 400, scimType?: string, extraHeaders?: Record<string, string>): NextResponse {
  return scimJson(
    {
      schemas: [SCIM_SCHEMA_ERROR],
      status: String(status),
      ...(scimType ? { scimType } : {}),
      detail,
    },
    status,
    extraHeaders
  );
}

export function hashScimToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function getScimBaseUrl(req: NextRequest): string {
  const proto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(/:$/, "") || "https")
    .split(",")[0]
    .trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host)
    .split(",")[0]
    .trim();
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin.replace(/\/+$/, "");
}

export function scimRootUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (!clean) return "/api/scim/v2";
  return clean.endsWith("/api/scim/v2") ? clean : `${clean}/api/scim/v2`;
}

export async function parseScimBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_SCIM_BODY_BYTES) {
    throw new ScimHttpError(413, "Request payload exceeds the 256 KB SCIM limit.");
  }
  if (!text.trim()) {
    throw new ScimHttpError(400, "Request body cannot be empty.", "invalidSyntax");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ScimHttpError(400, "Request body is not valid JSON.", "invalidSyntax");
  }
}

export function handleScimRouteError(err: unknown): NextResponse {
  if (err instanceof ScimHttpError) {
    return scimError(err.detail, err.status, err.scimType);
  }
  if (err instanceof z.ZodError) {
    return scimError(err.issues.map((i) => i.message).join("; ") || "Invalid SCIM payload.", 400, "invalidValue");
  }
  if (err instanceof Error && !/prisma|invalid .* invocation/i.test(err.message)) {
    return scimError(err.message, 400, "invalidValue");
  }
  return scimError("Internal server error.", 500);
}

export async function authenticateScim(req: NextRequest): Promise<ScimAuthContext | NextResponse> {
  const mt = await getMaintenanceCached().catch(() => null);
  if (mt && mt.enabled && mt.areas.includes("api")) {
    const wait = mt.endsAt && Date.parse(mt.endsAt) > Date.now() ? Math.ceil((Date.parse(mt.endsAt) - Date.now()) / 1000) : 600;
    return scimError("The SCIM API is temporarily unavailable for maintenance.", 503, undefined, {
      "Retry-After": String(Math.min(wait, 3600)),
    });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  if (!match) {
    return scimError("Missing or malformed Bearer token. Send Authorization: Bearer <token>.", 401);
  }

  const tokenHash = hashScimToken(match[1]);
  const record = await prisma.scimToken.findUnique({
    where: { tokenHash },
    include: {
      workspace: {
        select: { id: true, suspendedAt: true, dataKeyEnc: true },
      },
    },
  });

  if (!record || record.revokedAt) {
    return scimError("Invalid or revoked SCIM bearer token.", 401);
  }

  const wait = await hit(`scim:${record.id}`, 300, 60);
  if (wait) {
    return scimError("SCIM rate limit exceeded (300 requests per minute).", 429, undefined, {
      "Retry-After": String(wait),
    });
  }

  if (!record.workspace || record.workspace.suspendedAt) {
    return scimError("This workspace is suspended.", 403);
  }

  if (await isWorkspaceLocked(record.workspace)) {
    return scimError("This workspace's encryption key is revoked, so records are locked.", 423);
  }

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    void prisma.scimToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return {
    workspaceId: record.workspaceId,
    tokenId: record.id,
    scopes: record.scopes,
  };
}

export function requireScimScope(auth: ScimAuthContext, scope: string): NextResponse | null {
  if (auth.scopes.length > 0 && !auth.scopes.includes(scope)) {
    return scimError(`This SCIM token does not have the "${scope}" scope.`, 403);
  }
  return null;
}

/* ---------- Custom-value helpers for SCIM metadata ---------- */

function readCustomMap(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return { ...(val as Record<string, unknown>) };
  }
  return {};
}

export function getMemberExternalId(member: ScimMemberRecord): string | undefined {
  const custom = readCustomMap(member.profile?.customValues);
  const ext = custom._scimExternalId;
  if (typeof ext === "string" && ext.trim()) return ext.trim();
  return member.profile?.staffCode || undefined;
}

function getMemberTitle(member: ScimMemberRecord): string | undefined {
  if (member.profile?.jobRole?.title) return member.profile.jobRole.title;
  const custom = readCustomMap(member.profile?.customValues);
  const title = custom._scimTitle;
  if (typeof title === "string" && title.trim()) return title.trim();
  return undefined;
}

function splitFullName(fullName: string): { formatted: string; givenName: string; familyName: string } {
  const formatted = fullName.trim();
  if (!formatted) return { formatted: "", givenName: "", familyName: "" };
  const parts = formatted.split(/\s+/);
  if (parts.length === 1) {
    return { formatted, givenName: parts[0], familyName: "" };
  }
  return {
    formatted,
    givenName: parts[0],
    familyName: parts.slice(1).join(" "),
  };
}

/* ---------- RFC 7643 Resource Serializers ---------- */

export function toScimUser(member: ScimMemberRecord, baseUrl: string) {
  const root = scimRootUrl(baseUrl);
  const fullName = (member.profile?.fullName || member.user.name || member.user.email).trim();
  const name = splitFullName(fullName);
  const externalId = getMemberExternalId(member);
  const title = getMemberTitle(member);
  const active = member.profile ? member.profile.status !== "TERMINATED" : true;
  const created = member.createdAt.toISOString();

  return {
    schemas: [SCIM_SCHEMA_USER],
    id: member.id,
    ...(externalId ? { externalId } : {}),
    userName: member.user.email,
    displayName: fullName,
    name,
    emails: [
      {
        value: member.user.email,
        type: "work",
        primary: true,
      },
    ],
    active,
    ...(title ? { title } : {}),
    meta: {
      resourceType: "User",
      created,
      lastModified: created,
      location: `${root}/Users/${member.id}`,
    },
  };
}

export function toScimGroup(dept: ScimGroupDepartment, members: ScimGroupMemberInput[], baseUrl: string) {
  const root = scimRootUrl(baseUrl);
  const serializedMembers = members
    .map((m) => {
      const value = m.memberId ?? m.id;
      const display = (m.display || m.fullName || m.profile?.fullName || m.user?.name || "").trim();
      return {
        value,
        $ref: `${root}/Users/${value}`,
        ...(display ? { display } : {}),
      };
    })
    .filter((m) => Boolean(m.value));

  return {
    schemas: [SCIM_SCHEMA_GROUP],
    id: dept.id,
    displayName: dept.name,
    members: serializedMembers,
    meta: {
      resourceType: "Group",
      location: `${root}/Groups/${dept.id}`,
    },
  };
}

/* ---------- Payload Parsing & Coercion ---------- */

function parseScimBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return undefined;
}

const scimEmailSchema = z.object({
  value: z.string().trim().min(1),
  type: z.string().optional(),
  primary: z.union([z.boolean(), z.string()]).optional(),
});

const scimNameSchema = z.object({
  formatted: z.string().trim().max(160).optional(),
  givenName: z.string().trim().max(100).optional(),
  familyName: z.string().trim().max(100).optional(),
  middleName: z.string().trim().max(100).optional(),
});

const scimUserPayloadSchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    externalId: z.string().trim().max(200).nullish(),
    userName: z.string().trim().max(254).optional(),
    displayName: z.string().trim().max(160).optional(),
    name: scimNameSchema.optional(),
    emails: z.array(scimEmailSchema).optional(),
    active: z.union([z.boolean(), z.string()]).optional(),
    title: z.string().trim().max(160).nullish(),
  })
  .passthrough();

type ParsedScimUserInput = {
  email: string;
  fullName: string;
  active: boolean;
  activeProvided: boolean;
  title: string | null | undefined;
  externalId: string | null | undefined;
};

function extractEmailFromEmails(emails?: Array<{ value: string; primary?: boolean | string }>): string | null {
  if (!emails || emails.length === 0) return null;
  const primary = emails.find((e) => parseScimBoolean(e.primary) === true);
  const ordered = primary ? [primary, ...emails.filter((e) => e !== primary)] : emails;
  for (const item of ordered) {
    const parsed = EMAIL_CHECK.safeParse(item.value);
    if (parsed.success) return parsed.data.toLowerCase();
  }
  return null;
}

function parseScimUserPayload(payload: unknown): ParsedScimUserInput {
  const d = scimUserPayloadSchema.parse(payload);

  let email: string | null = null;
  if (d.userName) {
    const parsed = EMAIL_CHECK.safeParse(d.userName);
    if (parsed.success) email = parsed.data.toLowerCase();
  }
  if (!email) {
    email = extractEmailFromEmails(d.emails);
  }
  if (!email) {
    throw new ScimHttpError(400, "A valid email address is required in userName or emails.", "invalidValue");
  }

  const composedName = [d.name?.givenName, d.name?.middleName, d.name?.familyName]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  const fullName =
    d.name?.formatted?.trim() ||
    composedName ||
    d.displayName?.trim() ||
    email.split("@")[0];

  const coercedActive = d.active === undefined ? undefined : parseScimBoolean(d.active);
  if (d.active !== undefined && coercedActive === undefined) {
    throw new ScimHttpError(400, 'Attribute "active" must be a boolean.', "invalidValue");
  }

  return {
    email,
    fullName: fullName.slice(0, 120),
    active: coercedActive ?? true,
    activeProvided: coercedActive !== undefined,
    title: d.title === undefined ? undefined : d.title?.trim() || null,
    externalId: d.externalId === undefined ? undefined : d.externalId?.trim() || null,
  };
}

/* ---------- Member Queries & Helpers ---------- */

export const SCIM_MEMBER_INCLUDE = {
  user: {
    select: { id: true, email: true, name: true, createdAt: true },
  },
  profile: {
    include: {
      jobRole: { select: { id: true, title: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

export async function findScimMember(workspaceId: string, memberId: string): Promise<ScimMemberRecord | null> {
  return prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    include: SCIM_MEMBER_INCLUDE,
  });
}

async function nextScimStaffCode(tx: Prisma.TransactionClient, workspaceId: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const candidate = `SCIM-${randomInt(1000, 10000)}`;
    const exists = await tx.employeeProfile.findUnique({
      where: { workspaceId_staffCode: { workspaceId, staffCode: candidate } },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `SCIM-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function resolveJobRoleId(tx: Prisma.TransactionClient, workspaceId: string, title: string | null | undefined): Promise<string | null | undefined> {
  if (title === undefined) return undefined;
  if (!title) return null;
  const role = await tx.jobRole.findFirst({
    where: { workspaceId, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  return role?.id ?? null;
}

function mergeScimCustomValues(
  existing: unknown,
  updates: { externalId?: string | null; title?: string | null; matchedJobRole?: boolean }
): { next: Prisma.InputJsonValue; changed: boolean } {
  const map = readCustomMap(existing);
  let changed = false;

  if (updates.externalId !== undefined) {
    if (updates.externalId) {
      if (map._scimExternalId !== updates.externalId) {
        map._scimExternalId = updates.externalId;
        changed = true;
      }
    } else if ("_scimExternalId" in map) {
      delete map._scimExternalId;
      changed = true;
    }
  }

  if (updates.title !== undefined) {
    if (updates.title && !updates.matchedJobRole) {
      if (map._scimTitle !== updates.title) {
        map._scimTitle = updates.title;
        changed = true;
      }
    } else if ("_scimTitle" in map) {
      delete map._scimTitle;
      changed = true;
    }
  }

  return { next: map as Prisma.InputJsonValue, changed };
}

/* ---------- Instant Deprovisioning ---------- */

export async function deprovisionScimUser(
  workspaceId: string,
  memberId: string,
  reason: string
): Promise<ScimMemberRecord | null> {
  const cleanReason = reason.trim().slice(0, 300) || "Deprovisioned via SCIM 2.0";
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const member = await tx.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: SCIM_MEMBER_INCLUDE,
    });
    if (!member) return null;

    let employeeId = member.profile?.id ?? null;
    if (member.profile) {
      await tx.employeeProfile.update({
        where: { id: member.profile.id },
        data: {
          status: "TERMINATED",
          separationDate: now,
          separationReason: cleanReason,
        },
      });
    } else {
      const unlinked = await tx.employeeProfile.findFirst({
        where: {
          workspaceId,
          email: { equals: member.user.email, mode: "insensitive" },
          memberId: null,
        },
        select: { id: true },
      });
      if (unlinked) {
        employeeId = unlinked.id;
        await tx.employeeProfile.update({
          where: { id: unlinked.id },
          data: {
            memberId: member.id,
            status: "TERMINATED",
            separationDate: now,
            separationReason: cleanReason,
          },
        });
      }
    }

    // Immediately revoke every active browser session for this user
    const revokedSessions = await tx.userSession.updateMany({
      where: { userId: member.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    // Advance passwordChangedAt so every existing JWT cookie is rejected on the very next request
    await tx.user.update({
      where: { id: member.userId },
      data: { passwordChangedAt: now },
    });

    await writeAudit(tx, {
      workspaceId,
      actorMemberId: null,
      actorName: "SCIM 2.0",
      actionType: "SCIM_USER_DEPROVISIONED",
      targetType: "WorkspaceMember",
      targetId: member.id,
      summary: `${member.user.name} (${member.user.email}) deprovisioned via SCIM 2.0; ${revokedSessions.count} active session(s) revoked`,
      metadata: {
        memberId: member.id,
        userId: member.userId,
        employeeId,
        email: member.user.email,
        reason: cleanReason,
        revokedSessions: revokedSessions.count,
      },
    });

    return tx.workspaceMember.findFirst({
      where: { id: member.id, workspaceId },
      include: SCIM_MEMBER_INCLUDE,
    });
  });

  return result;
}

/* ---------- Provisioning (POST /Users) ---------- */

export async function provisionScimUser(workspaceId: string, payload: unknown): Promise<ScimMemberRecord> {
  const input = parseScimUserPayload(payload);

  // Pre-compute random password hash outside the DB transaction if user does not yet exist
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true },
  });
  const randomPasswordHash = existingUser
    ? null
    : await hashPassword(randomBytes(32).toString("base64url"));

  const provisioned = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email: input.email,
          name: input.fullName,
          passwordHash: randomPasswordHash ?? (await hashPassword(randomBytes(32).toString("base64url"))),
          passwordSetAt: null,
        },
      });
    } else if (input.fullName && user.name !== input.fullName) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { name: input.fullName },
      });
    }

    const member = await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      create: { workspaceId, userId: user.id, role: "EMPLOYEE" },
      update: {},
    });

    const jobRoleId = await resolveJobRoleId(tx, workspaceId, input.title);

    let profile = await tx.employeeProfile.findUnique({ where: { memberId: member.id } });
    if (!profile) {
      profile = await tx.employeeProfile.findFirst({
        where: {
          workspaceId,
          email: { equals: input.email, mode: "insensitive" },
          memberId: null,
        },
      });
    }

    if (profile) {
      const merged = mergeScimCustomValues(profile.customValues, {
        externalId: input.externalId,
        title: input.title,
        matchedJobRole: Boolean(jobRoleId),
      });

      const reactivating = input.active && profile.status === "TERMINATED";
      await tx.employeeProfile.update({
        where: { id: profile.id },
        data: {
          memberId: member.id,
          fullName: input.fullName,
          email: input.email,
          ...(jobRoleId !== undefined ? { jobRoleId } : {}),
          ...(merged.changed ? { customValues: merged.next } : {}),
          ...(reactivating ? { status: "ACTIVE", separationDate: null, separationReason: null } : {}),
        },
      });
    } else {
      const staffCode = await nextScimStaffCode(tx, workspaceId);
      const merged = mergeScimCustomValues(
        {},
        {
          externalId: input.externalId,
          title: input.title,
          matchedJobRole: Boolean(jobRoleId),
        }
      );

      profile = await tx.employeeProfile.create({
        data: {
          workspaceId,
          memberId: member.id,
          staffCode,
          fullName: input.fullName,
          email: input.email,
          status: input.active ? "ONBOARDING" : "TERMINATED",
          ...(jobRoleId ? { jobRoleId } : {}),
          ...(merged.changed ? { customValues: merged.next } : {}),
        },
      });
    }

    await writeAudit(tx, {
      workspaceId,
      actorMemberId: null,
      actorName: "SCIM 2.0",
      actionType: "SCIM_USER_PROVISIONED",
      targetType: "WorkspaceMember",
      targetId: member.id,
      summary: `${input.fullName} (${input.email}) provisioned via SCIM 2.0`,
      metadata: {
        memberId: member.id,
        userId: user.id,
        employeeId: profile.id,
        staffCode: profile.staffCode,
        email: input.email,
        active: input.active,
        externalId: input.externalId ?? null,
      },
    });

    return tx.workspaceMember.findFirstOrThrow({
      where: { id: member.id, workspaceId },
      include: SCIM_MEMBER_INCLUDE,
    });
  });

  if (!input.active) {
    const deprovisioned = await deprovisionScimUser(
      workspaceId,
      provisioned.id,
      "Deprovisioned via SCIM 2.0 (created with active=false)"
    );
    if (deprovisioned) return deprovisioned;
  }

  return provisioned;
}

/* ---------- Replace User (PUT /Users/[id]) ---------- */

export async function replaceScimUser(
  workspaceId: string,
  memberId: string,
  payload: unknown
): Promise<ScimMemberRecord | null> {
  const input = parseScimUserPayload(payload);

  const existing = await findScimMember(workspaceId, memberId);
  if (!existing) return null;

  const emailChanged = input.email !== existing.user.email.toLowerCase();
  if (emailChanged) {
    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: input.email, mode: "insensitive" },
        NOT: { id: existing.userId },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ScimHttpError(409, "That email address is already assigned to another user.", "uniqueness");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        name: input.fullName,
        ...(emailChanged ? { email: input.email } : {}),
      },
    });

    const jobRoleId = await resolveJobRoleId(tx, workspaceId, input.title ?? null);
    const wasTerminated = existing.profile?.status === "TERMINATED";
    const reactivating = input.active && wasTerminated;

    if (existing.profile) {
      const merged = mergeScimCustomValues(existing.profile.customValues, {
        externalId: input.externalId === undefined ? null : input.externalId,
        title: input.title === undefined ? null : input.title,
        matchedJobRole: Boolean(jobRoleId),
      });

      await tx.employeeProfile.update({
        where: { id: existing.profile.id },
        data: {
          fullName: input.fullName,
          email: input.email,
          jobRoleId: jobRoleId ?? null,
          ...(merged.changed ? { customValues: merged.next } : {}),
          ...(reactivating ? { status: "ACTIVE", separationDate: null, separationReason: null } : {}),
        },
      });
    } else {
      const staffCode = await nextScimStaffCode(tx, workspaceId);
      const merged = mergeScimCustomValues(
        {},
        {
          externalId: input.externalId,
          title: input.title,
          matchedJobRole: Boolean(jobRoleId),
        }
      );

      await tx.employeeProfile.create({
        data: {
          workspaceId,
          memberId: existing.id,
          staffCode,
          fullName: input.fullName,
          email: input.email,
          status: input.active ? "ACTIVE" : "TERMINATED",
          ...(jobRoleId ? { jobRoleId } : {}),
          ...(merged.changed ? { customValues: merged.next } : {}),
        },
      });
    }

    if (input.active) {
      await writeAudit(tx, {
        workspaceId,
        actorMemberId: null,
        actorName: "SCIM 2.0",
        actionType: reactivating ? "SCIM_USER_REACTIVATED" : "SCIM_USER_UPDATED",
        targetType: "WorkspaceMember",
        targetId: existing.id,
        summary: reactivating
          ? `${input.fullName} (${input.email}) reactivated via SCIM 2.0`
          : `${input.fullName} (${input.email}) updated via SCIM 2.0 PUT`,
        metadata: {
          memberId: existing.id,
          userId: existing.userId,
          email: input.email,
          reactivated: reactivating,
        },
      });
    }

    return tx.workspaceMember.findFirstOrThrow({
      where: { id: existing.id, workspaceId },
      include: SCIM_MEMBER_INCLUDE,
    });
  });

  if (!input.active) {
    const deprovisioned = await deprovisionScimUser(workspaceId, memberId, "Deprovisioned via SCIM 2.0 PUT");
    if (deprovisioned) return deprovisioned;
  }

  return updated;
}

/* ---------- Patch User (PATCH /Users/[id], RFC 7644 §3.5.2) ---------- */

const patchOpSchema = z.object({
  schemas: z.array(z.string()).optional(),
  Operations: z
    .array(
      z.object({
        op: z.string().min(1),
        path: z.string().optional(),
        value: z.unknown().optional(),
      })
    )
    .min(1, "PATCH Operations must contain at least one operation."),
});

type PatchWorkState = {
  email: string;
  givenName: string;
  familyName: string;
  formattedName: string | null;
  active: boolean;
  activeTouched: boolean;
  title: string | null | undefined;
  externalId: string | null | undefined;
};

function applyPatchAttribute(state: PatchWorkState, rawPath: string, op: "add" | "replace" | "remove", value: unknown) {
  const path = rawPath.trim().toLowerCase();

  if (path === "active") {
    if (op === "remove") {
      state.active = false;
      state.activeTouched = true;
      return;
    }
    const boolVal = parseScimBoolean(value);
    if (boolVal === undefined) {
      throw new ScimHttpError(400, 'PATCH value for "active" must be a boolean.', "invalidValue");
    }
    state.active = boolVal;
    state.activeTouched = true;
    return;
  }

  if (path === "username") {
    if (op === "remove") return;
    if (typeof value !== "string" || !EMAIL_CHECK.safeParse(value).success) {
      throw new ScimHttpError(400, 'PATCH value for "userName" must be a valid email.', "invalidValue");
    }
    state.email = value.trim().toLowerCase();
    return;
  }

  if (path === "emails" || path === "emails.value" || /^emails\[[^\]]*\]\.value$/.test(path)) {
    if (op === "remove") return;
    if (typeof value === "string") {
      const parsed = EMAIL_CHECK.safeParse(value);
      if (!parsed.success) throw new ScimHttpError(400, "Invalid email address in PATCH operation.", "invalidValue");
      state.email = parsed.data.toLowerCase();
      return;
    }
    if (Array.isArray(value)) {
      const parsedEmails = z.array(scimEmailSchema).safeParse(value);
      const found = parsedEmails.success ? extractEmailFromEmails(parsedEmails.data) : null;
      if (!found) throw new ScimHttpError(400, "No valid email found in PATCH emails array.", "invalidValue");
      state.email = found;
      return;
    }
    if (value && typeof value === "object" && "value" in value) {
      const parsed = EMAIL_CHECK.safeParse((value as { value?: unknown }).value);
      if (!parsed.success) throw new ScimHttpError(400, "Invalid email address in PATCH operation.", "invalidValue");
      state.email = parsed.data.toLowerCase();
      return;
    }
    throw new ScimHttpError(400, "Unsupported value for PATCH emails.", "invalidValue");
  }

  if (path === "displayname" || path === "name.formatted") {
    if (op === "remove") {
      state.formattedName = null;
      return;
    }
    if (typeof value === "string" && value.trim()) {
      const split = splitFullName(value);
      state.formattedName = split.formatted;
      state.givenName = split.givenName;
      state.familyName = split.familyName;
    }
    return;
  }

  if (path === "name.givenname") {
    state.givenName = op === "remove" ? "" : typeof value === "string" ? value.trim() : state.givenName;
    state.formattedName = null;
    return;
  }

  if (path === "name.familyname") {
    state.familyName = op === "remove" ? "" : typeof value === "string" ? value.trim() : state.familyName;
    state.formattedName = null;
    return;
  }

  if (path === "name") {
    if (op === "remove") {
      state.givenName = "";
      state.familyName = "";
      state.formattedName = null;
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const n = value as Record<string, unknown>;
      if (typeof n.givenName === "string") {
        state.givenName = n.givenName.trim();
        state.formattedName = null;
      }
      if (typeof n.familyName === "string") {
        state.familyName = n.familyName.trim();
        state.formattedName = null;
      }
      if (typeof n.formatted === "string" && n.formatted.trim()) {
        const split = splitFullName(n.formatted);
        state.formattedName = split.formatted;
        if (!n.givenName) state.givenName = split.givenName;
        if (!n.familyName) state.familyName = split.familyName;
      }
    }
    return;
  }

  if (path === "title") {
    if (op === "remove") {
      state.title = null;
      return;
    }
    state.title = typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
    return;
  }

  if (path === "externalid") {
    if (op === "remove") {
      state.externalId = null;
      return;
    }
    state.externalId = typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
  }
}

export async function patchScimUser(
  workspaceId: string,
  memberId: string,
  payload: unknown
): Promise<ScimMemberRecord | null> {
  const parsed = patchOpSchema.parse(payload);
  if (parsed.schemas && parsed.schemas.length > 0 && !parsed.schemas.includes(SCIM_SCHEMA_PATCH)) {
    throw new ScimHttpError(400, `PATCH payload must declare schema "${SCIM_SCHEMA_PATCH}".`, "invalidSyntax");
  }

  const existing = await findScimMember(workspaceId, memberId);
  if (!existing) return null;

  const initialName = splitFullName(existing.profile?.fullName || existing.user.name);
  const state: PatchWorkState = {
    email: existing.user.email.toLowerCase(),
    givenName: initialName.givenName,
    familyName: initialName.familyName,
    formattedName: initialName.formatted,
    active: existing.profile ? existing.profile.status !== "TERMINATED" : true,
    activeTouched: false,
    title: undefined,
    externalId: undefined,
  };

  for (const rawOp of parsed.Operations) {
    const op = rawOp.op.trim().toLowerCase();
    if (op !== "add" && op !== "replace" && op !== "remove") {
      throw new ScimHttpError(400, `Unsupported SCIM PATCH op "${rawOp.op}".`, "invalidSyntax");
    }

    if (rawOp.path && rawOp.path.trim()) {
      applyPatchAttribute(state, rawOp.path, op, rawOp.value);
    } else if (op !== "remove" && rawOp.value && typeof rawOp.value === "object" && !Array.isArray(rawOp.value)) {
      for (const [key, val] of Object.entries(rawOp.value as Record<string, unknown>)) {
        applyPatchAttribute(state, key, op, val);
      }
    } else if (op === "remove" && !rawOp.path) {
      throw new ScimHttpError(400, 'PATCH "remove" operation requires a "path".', "noTarget");
    }
  }

  const nextFullName = (
    state.formattedName ||
    [state.givenName, state.familyName].filter(Boolean).join(" ") ||
    existing.profile?.fullName ||
    existing.user.name
  )
    .trim()
    .slice(0, 120);

  const emailChanged = state.email !== existing.user.email.toLowerCase();
  if (emailChanged) {
    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: state.email, mode: "insensitive" },
        NOT: { id: existing.userId },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ScimHttpError(409, "That email address is already assigned to another user.", "uniqueness");
    }
  }

  const wasTerminated = existing.profile?.status === "TERMINATED";
  const shouldDeprovision = state.activeTouched && !state.active;
  const shouldReactivate = state.activeTouched && state.active && wasTerminated;

  const updated = await prisma.$transaction(async (tx) => {
    if (nextFullName !== existing.user.name || emailChanged) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          name: nextFullName,
          ...(emailChanged ? { email: state.email } : {}),
        },
      });
    }

    const jobRoleId = await resolveJobRoleId(tx, workspaceId, state.title);

    if (existing.profile) {
      const merged = mergeScimCustomValues(existing.profile.customValues, {
        externalId: state.externalId,
        title: state.title,
        matchedJobRole: Boolean(jobRoleId),
      });

      await tx.employeeProfile.update({
        where: { id: existing.profile.id },
        data: {
          fullName: nextFullName,
          email: state.email,
          ...(jobRoleId !== undefined ? { jobRoleId } : {}),
          ...(merged.changed ? { customValues: merged.next } : {}),
          ...(shouldReactivate ? { status: "ACTIVE", separationDate: null, separationReason: null } : {}),
        },
      });
    }

    if (!shouldDeprovision) {
      await writeAudit(tx, {
        workspaceId,
        actorMemberId: null,
        actorName: "SCIM 2.0",
        actionType: shouldReactivate ? "SCIM_USER_REACTIVATED" : "SCIM_USER_UPDATED",
        targetType: "WorkspaceMember",
        targetId: existing.id,
        summary: shouldReactivate
          ? `${nextFullName} (${state.email}) reactivated via SCIM 2.0 PATCH`
          : `${nextFullName} (${state.email}) updated via SCIM 2.0 PATCH`,
        metadata: {
          memberId: existing.id,
          userId: existing.userId,
          email: state.email,
          reactivated: shouldReactivate,
        },
      });
    }

    return tx.workspaceMember.findFirstOrThrow({
      where: { id: existing.id, workspaceId },
      include: SCIM_MEMBER_INCLUDE,
    });
  });

  if (shouldDeprovision) {
    const deprovisioned = await deprovisionScimUser(workspaceId, memberId, "Deprovisioned via SCIM 2.0 PATCH");
    if (deprovisioned) return deprovisioned;
  }

  return updated;
}

/* ---------- RFC 7644 Filter Support ---------- */

export type ScimFilterClause = {
  attr: string;
  op: "eq" | "ne" | "co" | "sw" | "ew" | "pr";
  value?: string;
};

function splitAndClauses(filter: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  let escaped = false;
  let bracketDepth = 0;

  for (let i = 0; i < filter.length; i++) {
    const ch = filter[i];
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && inQuote) {
      cur += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote) {
      if (ch === "[") bracketDepth++;
      else if (ch === "]" && bracketDepth > 0) bracketDepth--;
    }
    if (!inQuote && bracketDepth === 0 && /\s/.test(ch)) {
      const rest = filter.slice(i);
      const m = /^\s+and\s+/i.exec(rest);
      if (m) {
        if (cur.trim()) parts.push(cur.trim());
        cur = "";
        i += m[0].length - 1;
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function normalizeFilterAttr(attr: string): string {
  const clean = attr.trim().toLowerCase();
  if (/^emails\[[^\]]*\]\.value$/.test(clean) || clean === "emails.value" || clean === "emails") {
    return "emails.value";
  }
  return clean;
}

export function parseScimFilter(raw: string): ScimFilterClause[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const clauses = splitAndClauses(trimmed);
  const parsed: ScimFilterClause[] = [];

  for (const clause of clauses) {
    const unwrapped = clause.startsWith("(") && clause.endsWith(")") ? clause.slice(1, -1).trim() : clause;

    const prMatch = /^([A-Za-z0-9_.\[\] ="-]+?)\s+pr$/i.exec(unwrapped);
    if (prMatch) {
      parsed.push({ attr: normalizeFilterAttr(prMatch[1]), op: "pr" });
      continue;
    }

    const binMatch = /^([A-Za-z0-9_.\[\] ="-]+?)\s+(eq|ne|co|sw|ew)\s+(?:"((?:[^"\\]|\\.)*)"|(\S+))$/i.exec(unwrapped);
    if (!binMatch) {
      throw new ScimHttpError(400, `Unsupported or malformed SCIM filter: ${clause}`, "invalidFilter");
    }

    const attr = normalizeFilterAttr(binMatch[1]);
    const op = binMatch[2].toLowerCase() as ScimFilterClause["op"];
    const value = binMatch[3] !== undefined ? binMatch[3].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : binMatch[4];
    parsed.push({ attr, op, value });
  }

  return parsed;
}

function matchFilterValue(actual: string | undefined, op: ScimFilterClause["op"], expected?: string): boolean {
  if (op === "pr") return actual !== undefined && actual !== "";
  const a = (actual ?? "").toLowerCase();
  const b = (expected ?? "").toLowerCase();
  if (op === "eq") return a === b;
  if (op === "ne") return a !== b;
  if (op === "co") return a.includes(b);
  if (op === "sw") return a.startsWith(b);
  if (op === "ew") return a.endsWith(b);
  return false;
}

export function matchesScimUserFilter(member: ScimMemberRecord, clauses: ScimFilterClause[]): boolean {
  if (clauses.length === 0) return true;
  const fullName = (member.profile?.fullName || member.user.name || "").trim();
  const split = splitFullName(fullName);
  const activeStr = member.profile ? String(member.profile.status !== "TERMINATED") : "true";

  for (const c of clauses) {
    let actual: string | undefined;
    switch (c.attr) {
      case "username":
      case "emails.value":
        actual = member.user.email;
        break;
      case "id":
        actual = member.id;
        break;
      case "externalid":
        actual = getMemberExternalId(member);
        break;
      case "displayname":
      case "name.formatted":
        actual = fullName;
        break;
      case "name.givenname":
        actual = split.givenName;
        break;
      case "name.familyname":
        actual = split.familyName;
        break;
      case "title":
        actual = getMemberTitle(member);
        break;
      case "active":
        actual = activeStr;
        break;
      default:
        return false;
    }
    if (!matchFilterValue(actual, c.op, c.value)) return false;
  }
  return true;
}

export function matchesScimGroupFilter(dept: ScimGroupDepartment, clauses: ScimFilterClause[]): boolean {
  if (clauses.length === 0) return true;
  for (const c of clauses) {
    let actual: string | undefined;
    if (c.attr === "displayname") actual = dept.name;
    else if (c.attr === "id") actual = dept.id;
    else return false;
    if (!matchFilterValue(actual, c.op, c.value)) return false;
  }
  return true;
}

export function parseScimPagination(req: NextRequest): { startIndex: number; count: number } {
  const q = req.nextUrl.searchParams;
  const rawStart = Number.parseInt(q.get("startIndex") ?? "1", 10);
  const startIndex = Number.isNaN(rawStart) || rawStart < 1 ? 1 : rawStart;

  const rawCountParam = q.get("count");
  const parsedCount = rawCountParam === null ? 100 : Number.parseInt(rawCountParam, 10);
  const count = Number.isNaN(parsedCount) ? 100 : Math.min(200, Math.max(0, parsedCount));

  return { startIndex, count };
}
