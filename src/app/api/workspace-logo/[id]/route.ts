import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logoExtension } from "@/lib/logo";

export const dynamic = "force-dynamic";

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Publicly serves a workspace's uploaded logo (used on staff login pages, custom domains, sidebar, and admin downloads). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ws = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { slug: true, logoData: true, logoMime: true, logoUpdatedAt: true },
  });

  if (!ws || !ws.logoData) {
    return new NextResponse("Not found", { status: 404 });
  }

  const mime = ws.logoMime && ALLOWED_MIMES.has(ws.logoMime) ? ws.logoMime : "image/png";
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };

  if (req.nextUrl.searchParams.get("download") === "1") {
    const safeSlug = ws.slug.replace(/[^a-zA-Z0-9_-]/g, "") || "workspace";
    headers["Content-Disposition"] = `attachment; filename="${safeSlug}-logo.${logoExtension(mime)}"`;
  }

  return new NextResponse(Uint8Array.from(ws.logoData), { status: 200, headers });
}
