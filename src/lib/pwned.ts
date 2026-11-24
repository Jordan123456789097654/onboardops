import { createHash } from "crypto";

/**
 * How many times a password appears in known data breaches (Have I Been Pwned). Only the first 5 characters of the password's
 * SHA-1 hash are sent, so the password itself, and its full hash, never leave this server. If the service is slow or down, this
 * returns 0 so nobody is blocked from signing up because of someone else's outage.
 */
export async function pwnedCount(password: string): Promise<number> {
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha.slice(0, 5);
  const suffix = sha.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true", "User-Agent": "OnboardOps-password-check" }, signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split("\n")) {
      const [h, c] = line.trim().split(":");
      if (h === suffix) return Number(c) || 0;
    }
  } catch {
    // Fail open.
  }
  return 0;
}

export async function rejectBreachedPassword(password: string): Promise<void> {
  if ((await pwnedCount(password)) > 0) throw new Error("That password has appeared in known data breaches, so attackers already try it. Please choose a different one.");
}
