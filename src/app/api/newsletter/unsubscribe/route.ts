import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter-db";

export const dynamic = "force-dynamic";

/** Mail apps call this with POST when someone presses their Unsubscribe button (one-click unsubscribe). A plain visit goes to the confirmation page instead, so link scanners can't unsubscribe anyone by accident. */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  await unsubscribeByToken(token).catch(() => false);
  return new NextResponse(null, { status: 200 });
}

export function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return NextResponse.redirect(new URL(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, req.url), 303);
}
