import { AuthzError } from "@/lib/rbac";
import { ZodError } from "zod";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
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
