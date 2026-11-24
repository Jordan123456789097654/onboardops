import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashChatToken } from "@/lib/chat-ticket";
import { resolveMerged } from "@/lib/support";
import { enforceRate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PER_TICKET = 12;

function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.subarray(1, 4).toString() === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "GIF8") return "image/gif";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

/** A visitor adds a screenshot or PDF to their own ticket. Authenticated by the ticket's secret token. */
export async function POST(req: Request) {
  try {
    await enforceRate("support-upload", 20, 3600);
  } catch {
    return NextResponse.json({ error: "Too many uploads. Please wait a bit." }, { status: 429 });
  }
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 200 * 1024) return NextResponse.json({ error: "That file is too large. The limit is 3 MB." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  const token = String(form?.get("token") ?? "");
  const file = form?.get("file");
  if (!form || !(file instanceof File) || id.length < 5 || token.length < 20) return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is too large. The limit is 3 MB." }, { status: 413 });

  const src = await prisma.supportRequest.findUnique({ where: { id } });
  if (!src || !src.chatTokenHash || src.chatTokenHash !== hashChatToken(token)) return NextResponse.json({ error: "This conversation could not be found." }, { status: 404 });
  const target = await resolveMerged(src);
  if ((await prisma.supportAttachment.count({ where: { requestId: target.id } })) >= MAX_PER_TICKET) return NextResponse.json({ error: "This conversation has reached its attachment limit." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return NextResponse.json({ error: "Attach a PNG, JPG, GIF, WebP or PDF." }, { status: 400 });
  const name = (file.name || "attachment").replace(/[^\w.\- ]+/g, "_").slice(-80) || "attachment";
  const a = await prisma.supportAttachment.create({ data: { requestId: target.id, name, mime, size: buf.length, data: buf } });
  return NextResponse.json({ id: a.id, name: a.name, mime: a.mime, size: a.size });
}
