/** Which part of OnboardOps a path belongs to. Shared by the server guards and the browser gate, so it imports nothing heavy. */
export type MaintArea = "site" | "app" | "portal" | "api";
export const ALL_AREAS: MaintArea[] = ["site", "app", "portal", "api"];
export const AREA_LABEL: Record<MaintArea, string> = { site: "Website", app: "Workspace app", portal: "Employee portal", api: "API and webhooks" };
/** Reads as part of a sentence: "We are updating <phrase>." */
export const AREA_PHRASE: Record<MaintArea, string> = { site: "our website", app: "the workspace app", portal: "the employee portal", api: "the API" };

/** Paths that stay open no matter what: the staff console, sign-in and the status endpoints the lock screen itself relies on. */
const ALWAYS_OPEN = ["/admin", "/login", "/magic", "/status", "/api/maintenance", "/api/version", "/api/track", "/api/admin"];

export function areaFor(pathname: string): MaintArea {
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) return "api";
  if (pathname === "/app/my-portal" || pathname.startsWith("/app/my-portal/")) return "portal";
  if (["/app", "/print", "/account", "/workplaces", "/api/export"].some((p) => pathname === p || pathname.startsWith(p + "/"))) return "app";
  return "site";
}

export function isAlwaysOpen(pathname: string) {
  return ALWAYS_OPEN.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

type Lockable = { enabled: boolean; areas: MaintArea[] };

/** Is this path locked right now? */
export function lockedFor(m: Lockable, pathname: string): boolean {
  if (!m.enabled || isAlwaysOpen(pathname)) return false;
  return m.areas.includes(areaFor(pathname));
}

export function areasSentence(areas: MaintArea[]): string {
  const names = areas.map((a) => AREA_PHRASE[a]);
  if (names.length <= 1) return names[0] ?? "OnboardOps";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "3d 4h", "2h 05m", "12m 30s". */
export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
