import { NextResponse } from "next/server";
import { confirmStatusSubscription } from "@/lib/status-subscribers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await confirmStatusSubscription(token);
  return NextResponse.redirect(new URL(`/status-updates?state=${ok ? "confirmed" : "bad-link"}`, req.url), 303);
}
