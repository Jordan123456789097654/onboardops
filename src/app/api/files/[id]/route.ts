import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/auth";
import { mfaBlocked } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Streams a stored file after checking the caller may see the record it belongs to. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await getActiveMembership();
  if (!m) return new Response("Unauthorized", { status: 401 });
  if (mfaBlocked(m)) return new Response("Two-factor authentication is required by this workspace.", { status: 403 });
  const file = await prisma.storedFile.findFirst({ where: { id: params.id, workspaceId: m.workspaceId } });
  if (!file) return new Response("Not found", { status: 404 });

  const role = m.role;
  let ok = false;
  const policy = await prisma.policy.findFirst({ where: { fileId: file.id, workspaceId: m.workspaceId } });
  if (policy) ok = ["OWNER", "ADMIN", "MANAGER"].includes(role) || policy.isPublished;
  if (!ok) {
    const doc = await prisma.employeeDocument.findFirst({ where: { fileId: file.id, workspaceId: m.workspaceId } });
    if (doc) {
      if (role === "OWNER" || role === "ADMIN") ok = true;
      else if (role === "MANAGER") ok = !doc.restricted;
      else if (role === "EMPLOYEE") ok = doc.employeeId === m.profile?.id && doc.visibleToEmployee && !doc.restricted;
    }
  }
  if (!ok) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "Cache-Control": "private, no-store",
    },
  });
}
