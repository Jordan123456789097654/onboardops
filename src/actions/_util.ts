import { AuthzError } from "@/lib/rbac";
import { ZodError } from "zod";
import { headers } from "next/headers";
import { getMaintenanceCached } from "@/lib/maintenance";
import { areasSentence, areaFor, lockedFor } from "@/lib/maintenance-areas";

/** While an area is in maintenance, refuse changes made from its pages. The staff console and sign-in stay open. */
async function maintenanceBlock(): Promise<string | null> {
  try {
    const m = await getMaintenanceCached();
    if (!m.enabled) return null;
    const ref = headers().get("referer");
    if (!ref) return null;
    const path = new URL(ref).pathname;
    if (!lockedFor(m, path)) return null;
    return `We are updating ${areasSentence([areaFor(path)])} right now, so changes are paused. Please try again in a few minutes.`;
  } catch { return null; }
}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const blocked = await maintenanceBlock();
    if (blocked) return { ok: false, error: blocked };
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(". ") };
    if (e instanceof AuthzError) return { ok: false, error: e.message };
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw e;
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Something went wrong." };
  }
}
