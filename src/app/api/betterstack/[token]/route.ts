import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { applyIncidentWebhook } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** Better Stack incident webhook. The secret is in the URL, because Better Stack webhooks cannot send custom headers. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const expected = process.env.BETTERSTACK_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
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
