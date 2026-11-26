"use server";
import { headers } from "next/headers";
import { hit, clientIp } from "@/lib/rate-limit";
import { startStatusSubscription } from "@/lib/status-subscribers";

/** Always returns the same answer, so the form does not reveal whether an address is already subscribed. */
export async function subscribeStatusAction(email: string): Promise<{ ok: boolean; error?: string }> {
  const h = headers();
  const wait = await hit(`status-sub:${clientIp(new Headers(h))}`, 5, 3600);
  if (wait) return { ok: false, error: "Too many attempts. Try again later." };
  if (typeof email !== "string" || email.trim().length < 5) return { ok: false, error: "Enter a valid email address." };
  await startStatusSubscription(email).catch(() => undefined);
  return { ok: true };
}
