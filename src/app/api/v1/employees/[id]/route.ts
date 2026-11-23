import { prisma } from "@/lib/prisma";
import { apiError, authApiKey } from "@/lib/api-auth";
import { apiWrite, employeeOut, updateEmployee } from "@/lib/api-write";

export const dynamic = "force-dynamic";

/** GET /api/v1/employees/{id}. Scope: employees:read. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await authApiKey(req, { scope: "employees:read" });
  if (auth instanceof Response) return auth;
  const e = await prisma.employeeProfile.findFirst({ where: { id: params.id, workspaceId: auth.workspaceId }, include: { department: true, jobRole: true } });
  if (!e) return apiError(404, "not_found", "Employee not found.", auth.requestId);
  return Response.json({ data: employeeOut(e), requestId: auth.requestId });
}

/** PATCH /api/v1/employees/{id}. Scope: employees:write. Send only the fields to change. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiWrite(req, "employees:write", (a, body) => updateEmployee(a, params.id, body));
}
