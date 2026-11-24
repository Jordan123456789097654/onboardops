import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVisitorMessage, createTicket, isBlocked, refOf, resolveMerged } from "@/lib/support";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type Fields = Record<string, unknown>;

function pick(f: Fields, ...keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (typeof v === "string" && v.trim()) return v;
    if (v && typeof v === "object" && "email" in (v as object)) {
      const e = (v as { email?: unknown }).email;
      if (typeof e === "string" && e) return e;
    }
  }
  return "";
}

/** Reads JSON, form-encoded or multipart posts, so most inbound-mail services work without changes. */
async function readFields(req: Request): Promise<Fields | null> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const j = (await req.json()) as Fields;
      return j.data && typeof j.data === "object" ? { ...j, ...(j.data as Fields) } : j;
    }
    const fd = await req.formData();
    const out: Fields = {};
    fd.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
    return out;
  } catch {
    return null;
  }
}

function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .{5,200} wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^From:\s.+@/.test(line) || /^_{5,}$/.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const secret = process.env.SUPPORT_INBOUND_SECRET?.trim();
  if (!secret || !safeEq(params.token, secret)) return new NextResponse("Not found", { status: 404 });

  const f = await readFields(req);
  if (!f) return NextResponse.json({ error: "Unreadable body" }, { status: 400 });

  const fromRaw = pick(f, "from", "From", "sender", "from_email");
  const m = fromRaw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : fromRaw).trim().toLowerCase();
  const display = (m ? m[1] : "").trim();
  const subject = pick(f, "subject", "Subject").slice(0, 300);
  const rawText = pick(f, "stripped-text", "StrippedTextReply", "text", "TextBody", "body-plain", "plain", "body") || htmlToText(pick(f, "html", "HtmlBody", "body-html"));
  const body = stripQuoted(rawText).slice(0, 8000);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !body) return NextResponse.json({ ok: true, ignored: "no sender or body" });
  if (/^(out of office|automatic reply|auto:|undeliverable|delivery status)/i.test(subject.replace(/^(re|fwd?):\s*/i, ""))) return NextResponse.json({ ok: true, ignored: "auto-reply" });
  if (await isBlocked(email)) return NextResponse.json({ ok: true, ignored: "blocked" });

  const refMatch = subject.match(/\(([A-Z0-9]{8})\)/) ?? subject.match(/\[#([A-Z0-9]{8})\]/);
  if (refMatch) {
    const found = await prisma.supportRequest.findFirst({ where: { id: { endsWith: refMatch[1].toLowerCase() }, email } });
    if (found) {
      const target = await resolveMerged(found);
      await addVisitorMessage(target.id, target.name, body);
      return NextResponse.json({ ok: true, ref: refOf(target.id), threaded: true });
    }
  }

  const name = display || email.split("@")[0];
  const created = await createTicket({ name: name.slice(0, 100), email, topic: "Question", message: `${subject ? `${subject}\n\n` : ""}${body}`, source: "EMAIL" });
  return NextResponse.json({ ok: true, ref: refOf(created.id), threaded: false });
}
