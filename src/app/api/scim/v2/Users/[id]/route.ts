import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateScim,
  deprovisionScimUser,
  findScimMember,
  getScimBaseUrl,
  handleScimRouteError,
  parseScimBody,
  patchScimUser,
  replaceScimUser,
  requireScimScope,
  scimError,
  scimJson,
  toScimUser,
} from "@/lib/scim";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const member = await findScimMember(auth.workspaceId, params.id);
    if (!member) return scimError("User not found.", 404);
    return scimJson(toScimUser(member, getScimBaseUrl(req)), 200);
  } catch (err) {
    return handleScimRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  const scopeErr = requireScimScope(auth, "users:write");
  if (scopeErr) return scopeErr;

  try {
    const body = await parseScimBody(req);
    const updated = await replaceScimUser(auth.workspaceId, params.id, body);
    if (!updated) return scimError("User not found.", 404);
    return scimJson(toScimUser(updated, getScimBaseUrl(req)), 200);
  } catch (err) {
    return handleScimRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  const scopeErr = requireScimScope(auth, "users:write");
  if (scopeErr) return scopeErr;

  try {
    const body = await parseScimBody(req);
    const updated = await patchScimUser(auth.workspaceId, params.id, body);
    if (!updated) return scimError("User not found.", 404);
    return scimJson(toScimUser(updated, getScimBaseUrl(req)), 200);
  } catch (err) {
    return handleScimRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(req);
  if (auth instanceof NextResponse) return auth;

  const scopeErr = requireScimScope(auth, "users:write");
  if (scopeErr) return scopeErr;

  try {
    const removed = await deprovisionScimUser(
      auth.workspaceId,
      params.id,
      "Deprovisioned via SCIM 2.0 DELETE"
    );
    if (!removed) return scimError("User not found.", 404);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleScimRouteError(err);
  }
}
