export type PlatformRole = "OWNER" | "SUPPORT" | "VIEWER";
export const PLATFORM_ROLES: PlatformRole[] = ["OWNER", "SUPPORT", "VIEWER"];

export const PERMANENT_OWNER_EMAILS = ["jordanedanield13@gmail.com"];

/** Resolves a user's staff role: permanent owners, stored OWNER role, or PLATFORM_OWNER_EMAILS (bootstrap). */
export function resolvePlatformRole(user: { email: string; platformRole: string | null; emailVerifiedAt?: Date | null }): PlatformRole | null {
  const email = (user.email || "").trim().toLowerCase();
  const boot = (process.env.PLATFORM_OWNER_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (PERMANENT_OWNER_EMAILS.includes(email) || boot.includes(email)) return "OWNER";
  if (user.platformRole === "OWNER") return "OWNER";
  if (!user.emailVerifiedAt) return null; // an unverified email never grants normal staff access
  return PLATFORM_ROLES.includes(user.platformRole as PlatformRole) ? (user.platformRole as PlatformRole) : null;
}
