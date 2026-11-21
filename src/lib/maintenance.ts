import { prisma } from "./prisma";

export const MAINTENANCE_ROW_ID = "__platform_maintenance__";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  eta: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

const DEFAULT_MESSAGE = "OnboardOps is currently undergoing scheduled maintenance and upgrades. Your workspace data is safe and we will be back shortly.";

export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const row = await prisma.jobRun.findUnique({ where: { id: MAINTENANCE_ROW_ID } });
    if (!row) {
      return { enabled: false, message: DEFAULT_MESSAGE, eta: null, updatedBy: null, updatedAt: null };
    }
    const s = (row.summary ?? {}) as Record<string, unknown>;
    return {
      enabled: !!row.ok,
      message: typeof s.message === "string" && s.message.trim() ? s.message.trim() : DEFAULT_MESSAGE,
      eta: typeof s.eta === "string" && s.eta.trim() ? s.eta.trim() : null,
      updatedBy: typeof s.updatedBy === "string" ? s.updatedBy : null,
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : row.createdAt.toISOString(),
    };
  } catch {
    return { enabled: false, message: DEFAULT_MESSAGE, eta: null, updatedBy: null, updatedAt: null };
  }
}

export async function saveMaintenanceState(input: { enabled: boolean; message?: string; eta?: string | null; updatedBy: string }): Promise<MaintenanceState> {
  const message = input.message?.trim() || DEFAULT_MESSAGE;
  const eta = input.eta?.trim() || null;
  const updatedAt = new Date().toISOString();
  const summary = { enabled: input.enabled, message, eta, updatedBy: input.updatedBy, updatedAt };
  await prisma.jobRun.upsert({
    where: { id: MAINTENANCE_ROW_ID },
    create: {
      id: MAINTENANCE_ROW_ID,
      name: "platform:maintenance",
      ok: input.enabled,
      summary,
      durationMs: 0,
    },
    update: {
      ok: input.enabled,
      summary,
    },
  });
  return { enabled: input.enabled, message, eta, updatedBy: input.updatedBy, updatedAt };
}
