import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  SCIM_SCHEMA_LIST,
  ScimHttpError,
  authenticateScim,
  getScimBaseUrl,
  handleScimRouteError,
  matchesScimGroupFilter,
  parseScimBody,
  parseScimFilter,
  parseScimPagination,
  requireScimScope,
  scimJson,
  scimRootUrl,
  toScimGroup,
} from "@/lib/scim";

export const dynamic = "force-dynamic";

const createGroupSchema = z
  .object({
    schemas: z.array(z.string()).optional(),
    displayName: z.string().trim().min(1, "Group displayName is required.").max(100),
    members: z
      .array(
        z.object({
          value: z.string().trim().min(1).max(64),
          display: z.string().optional(),
          $ref: z.string().optional(),
        })
      )
      .optional(),
  })
  .passthrough();

export async function GET(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { startIndex, count } = parseScimPagination(req);
    const rawFilter = req.nextUrl.searchParams.get("filter") ?? "";
    const clauses = parseScimFilter(rawFilter);

    const departments = await prisma.department.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        employees: {
          where: { status: { not: "TERMINATED" }, memberId: { not: null } },
          select: { id: true, memberId: true, fullName: true },
          orderBy: { fullName: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const filtered = clauses.length > 0 ? departments.filter((d) => matchesScimGroupFilter(d, clauses)) : departments;
    const offset = startIndex - 1;
    const page = count === 0 ? [] : filtered.slice(offset, offset + count);
    const baseUrl = getScimBaseUrl(req);

    return scimJson(
      {
        schemas: [SCIM_SCHEMA_LIST],
        totalResults: filtered.length,
        startIndex,
        itemsPerPage: page.length,
        Resources: page.map((dept) => toScimGroup(dept, dept.employees, baseUrl)),
      },
      200
    );
  } catch (err) {
    return handleScimRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  const scopeErr = requireScimScope(auth, "groups:write");
  if (scopeErr) return scopeErr;

  try {
    const body = await parseScimBody(req);
    const input = createGroupSchema.parse(body);

    const existing = await prisma.department.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        name: { equals: input.displayName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ScimHttpError(409, `A group named "${input.displayName}" already exists.`, "uniqueness");
    }

    const memberValues = Array.from(new Set((input.members ?? []).map((m) => m.value)));

    const created = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          workspaceId: auth.workspaceId,
          name: input.displayName,
        },
      });

      let attachedCount = 0;
      if (memberValues.length > 0) {
        const res = await tx.employeeProfile.updateMany({
          where: {
            workspaceId: auth.workspaceId,
            OR: [{ memberId: { in: memberValues } }, { id: { in: memberValues } }],
          },
          data: { departmentId: dept.id },
        });
        attachedCount = res.count;
      }

      await writeAudit(tx, {
        workspaceId: auth.workspaceId,
        actorMemberId: null,
        actorName: "SCIM 2.0",
        actionType: "SCIM_GROUP_CREATED",
        targetType: "Department",
        targetId: dept.id,
        summary: `Department "${dept.name}" created via SCIM 2.0${attachedCount ? ` with ${attachedCount} member(s)` : ""}`,
        metadata: {
          departmentId: dept.id,
          displayName: dept.name,
          attachedMembers: attachedCount,
        },
      });

      return tx.department.findUniqueOrThrow({
        where: { id: dept.id },
        include: {
          employees: {
            where: { status: { not: "TERMINATED" }, memberId: { not: null } },
            select: { id: true, memberId: true, fullName: true },
            orderBy: { fullName: "asc" },
          },
        },
      });
    });

    const baseUrl = getScimBaseUrl(req);
    const location = `${scimRootUrl(baseUrl)}/Groups/${created.id}`;

    return scimJson(toScimGroup(created, created.employees, baseUrl), 201, { Location: location });
  } catch (err) {
    return handleScimRouteError(err);
  }
}
