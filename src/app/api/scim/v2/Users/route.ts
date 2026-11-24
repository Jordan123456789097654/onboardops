import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SCIM_MEMBER_INCLUDE,
  SCIM_SCHEMA_LIST,
  authenticateScim,
  getScimBaseUrl,
  handleScimRouteError,
  matchesScimUserFilter,
  parseScimBody,
  parseScimFilter,
  parseScimPagination,
  provisionScimUser,
  requireScimScope,
  scimJson,
  scimRootUrl,
  toScimUser,
} from "@/lib/scim";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { startIndex, count } = parseScimPagination(req);
    const rawFilter = req.nextUrl.searchParams.get("filter") ?? "";
    const clauses = parseScimFilter(rawFilter);

    const where: Prisma.WorkspaceMemberWhereInput = { workspaceId: auth.workspaceId };
    if (clauses.length === 1 && clauses[0].op === "eq" && clauses[0].value) {
      const c = clauses[0];
      if (c.attr === "username" || c.attr === "emails.value") {
        where.user = { email: { equals: c.value, mode: "insensitive" } };
      } else if (c.attr === "id") {
        where.id = c.value;
      }
    }

    const members = await prisma.workspaceMember.findMany({
      where,
      include: SCIM_MEMBER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    const filtered = clauses.length > 0 ? members.filter((m) => matchesScimUserFilter(m, clauses)) : members;
    const offset = startIndex - 1;
    const page = count === 0 ? [] : filtered.slice(offset, offset + count);
    const baseUrl = getScimBaseUrl(req);

    return scimJson(
      {
        schemas: [SCIM_SCHEMA_LIST],
        totalResults: filtered.length,
        startIndex,
        itemsPerPage: page.length,
        Resources: page.map((m) => toScimUser(m, baseUrl)),
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

  const scopeErr = requireScimScope(auth, "users:write");
  if (scopeErr) return scopeErr;

  try {
    const body = await parseScimBody(req);
    const member = await provisionScimUser(auth.workspaceId, body);
    const baseUrl = getScimBaseUrl(req);
    const location = `${scimRootUrl(baseUrl)}/Users/${member.id}`;

    return scimJson(toScimUser(member, baseUrl), 201, { Location: location });
  } catch (err) {
    return handleScimRouteError(err);
  }
}
