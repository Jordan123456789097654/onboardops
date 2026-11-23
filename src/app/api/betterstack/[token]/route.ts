import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { applyIncidentWebhook } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** Better Stack incident webhook. The secret is in the URL, because Better Stack webhooks cannot send custom headers. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { token } = params;
  const expected = process.env.BETTERSTACK_WEBHOOK_SECRET?.trim() ?? "";
  const actualBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (!expected || actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  try {
    const r = await applyIncidentWebhook(body);
    return NextResponse.json({ ok: r.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
