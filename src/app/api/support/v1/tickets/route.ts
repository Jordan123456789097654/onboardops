import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, authSupportApi, ticketJson } from "@/lib/support-api";

export const dynamic = "force-dynamic";

/** GET /api/support/v1/tickets?status=&priority=&tag=&q=&limit=&before=<ISO date> */
export async function GET(req: Request) {
  const auth = await authSupportApi(req);
  if ("res" in auth) return auth.res;
  const u = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit") ?? 25) || 25));
  const before = u.searchParams.get("before");
  const q = u.searchParams.get("q")?.trim();
  const beforeDate = before ? new Date(before) : null;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) return apiError("Invalid 'before' date", 400);
  const rows = await prisma.supportRequest.findMany({
    where: {
      spam: false,
      mergedIntoId: null,
      NOT: { topic: "Privacy request" },
      ...(u.searchParams.get("status") ? { status: u.searchParams.get("status")!.toUpperCase() } : {}),
      ...(u.searchParams.get("priority") ? { priority: u.searchParams.get("priority")!.toUpperCase() } : {}),
      ...(u.searchParams.get("tag") ? { tags: { has: u.searchParams.get("tag")!.toLowerCase() } } : {}),
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      ...(q ? { OR: [{ message: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ tickets: rows.map((r) => ticketJson(r)), next: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null });
}
