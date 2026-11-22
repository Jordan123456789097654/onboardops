export type WorkspaceBranding = {
  accentColor: string;
  logoFileId: string | null;
  themeMode: "system" | "light" | "dark";
  tagline: string;
};

type RawMap = Record<string, unknown> | null | undefined;

export function isPartnerWorkspace(features: unknown): boolean {
  const m = features as RawMap;
  return m?.__partner === true;
}

export function getStrikeDecayDays(features: unknown): number {
  const m = features as RawMap;
  const n = Number(m?.__strikeDecayDays ?? 0);
  return Number.isFinite(n) && n >= 7 && n <= 730 ? Math.floor(n) : 0;
}

export function getWorkspaceBranding(features: unknown): WorkspaceBranding {
  const m = features as RawMap;
  const b = (m?.__branding ?? {}) as Record<string, unknown>;
  const color = typeof b.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.accentColor) ? b.accentColor : "";
  const logoFileId = typeof b.logoFileId === "string" && b.logoFileId ? b.logoFileId : null;
  const themeMode = b.themeMode === "dark" || b.themeMode === "light" ? b.themeMode : "system";
  const tagline = typeof b.tagline === "string" ? b.tagline.slice(0, 140) : "";
  return { accentColor: color, logoFileId, themeMode, tagline };
}

/** Converts #RRGGBB into space-separated RGB channels ("29 78 216") for Tailwind CSS var(--accent). */
export function hexToRgbChannels(hex: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function mergeWorkspaceMeta(existingFeatures: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = existingFeatures && typeof existingFeatures === "object" && !Array.isArray(existingFeatures) ? { ...(existingFeatures as Record<string, unknown>) } : {};
  return { ...base, ...patch };
}
