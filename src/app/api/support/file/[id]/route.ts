import { prisma } from "@/lib/prisma";
import { hashChatToken } from "@/lib/chat-ticket";
import { getStaff, SUPPORT_STAFF } from "@/lib/platform";
import { resolveMerged } from "@/lib/support";

export const dynamic = "force-dynamic";

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Serves a ticket attachment to the ticket's owner (secret token) or to support staff. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const att = await prisma.supportAttachment.findUnique({ where: { id: params.id } });
  if (!att) return new Response("Not found", { status: 404 });

  const staff = await getStaff();
  let allowed = !!staff && SUPPORT_STAFF.includes(staff.role);
  if (!allowed) {
    const url = new URL(req.url);
    const rid = url.searchParams.get("r") ?? "";
    const token = url.searchParams.get("t") ?? "";
    const src = rid.length >= 5 ? await prisma.supportRequest.findUnique({ where: { id: rid } }) : null;
    if (src?.chatTokenHash && token.length >= 20 && src.chatTokenHash === hashChatToken(token)) {
      allowed = (await resolveMerged(src)).id === att.requestId;
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const safeName = att.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(att.data), {
    headers: {
      "content-type": att.mime,
      "content-length": String(att.size),
      "content-disposition": `${INLINE.has(att.mime) ? "inline" : "attachment"}; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
