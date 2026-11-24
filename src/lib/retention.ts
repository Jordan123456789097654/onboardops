import { prisma } from "./prisma";

export const DATA_REGIONS = ["US", "EU", "UK", "CA"] as const;
export type DataRegion = (typeof DATA_REGIONS)[number];

export const DATA_REGION_LABELS: Record<DataRegion, string> = {
  US: "US — United States (Virginia)",
  EU: "EU — European Union (Frankfurt)",
  UK: "UK — United Kingdom (London)",
  CA: "CA — Canada (Montreal)",
};

export type RetentionPolicy = {
  wormLocked: boolean;
  i9OshaDays: number;
  disciplineDays: number;
  trainingDays: number;
  policiesDays: number;
  terminatedPiiDays: number;
  lastPurgeAt?: string | null;
  lastPurgeSummary?: string | null;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  wormLocked: false,
  i9OshaDays: 1825,
  disciplineDays: 2555,
  trainingDays: 1825,
  policiesDays: 2555,
  terminatedPiiDays: 1095,
  lastPurgeAt: null,
  lastPurgeSummary: null,
};

export type RetentionPurgeResult =
  | {
      blockedByLegalHold: true;
      dryRun: boolean;
      counts: { expiredDocs: number; terminatedPii: number; oldIncidents: number };
    }
  | {
      blockedByLegalHold: false;
      dryRun: boolean;
      counts: { expiredDocs: number; terminatedPii: number };
    };

function parseDays(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < 30) return 30;
  if (rounded > 36500) return 36500;
  return rounded;
}

export function isDataRegion(v: unknown): v is DataRegion {
  return typeof v === "string" && (DATA_REGIONS as readonly string[]).includes(v);
}

export function parseRetentionPolicy(raw: unknown): RetentionPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_RETENTION_POLICY };
  }
  const o = raw as Record<string, unknown>;
  return {
    wormLocked: o.wormLocked === true,
    i9OshaDays: parseDays(o.i9OshaDays, DEFAULT_RETENTION_POLICY.i9OshaDays),
    disciplineDays: parseDays(o.disciplineDays, DEFAULT_RETENTION_POLICY.disciplineDays),
    trainingDays: parseDays(o.trainingDays, DEFAULT_RETENTION_POLICY.trainingDays),
    policiesDays: parseDays(o.policiesDays, DEFAULT_RETENTION_POLICY.policiesDays),
    terminatedPiiDays: parseDays(o.terminatedPiiDays, DEFAULT_RETENTION_POLICY.terminatedPiiDays),
    lastPurgeAt: typeof o.lastPurgeAt === "string" ? o.lastPurgeAt : null,
    lastPurgeSummary: typeof o.lastPurgeSummary === "string" ? o.lastPurgeSummary : null,
  };
}

/** Throws a clear error if the workspace is under an active Legal Hold. */
export function assertNotUnderLegalHold(ws: { legalHold: boolean; legalHoldReason?: string | null }): void {
  if (!ws.legalHold) return;
  const reason = ws.legalHoldReason?.trim();
  throw new Error(
    reason
      ? `This workspace is under an active Legal Hold ("${reason}"). Record purges, deletions, and workspace closure are frozen until the hold is lifted.`
      : "This workspace is under an active Legal Hold. Record purges, deletions, and workspace closure are frozen until the hold is lifted.",
  );
}

const DAY_MS = 86_400_000;
const WORM_STATUTORY_MIN_DAYS = 1095; // 3-year federal statutory floor when WORM lock is active

function hasRedactablePii(emp: {
  phone: string | null;
  emergencyContact: string | null;
  customValues: unknown;
}): boolean {
  const hasPhone = typeof emp.phone === "string" && emp.phone.trim().length > 0;
  const hasEmergency = typeof emp.emergencyContact === "string" && emp.emergencyContact.trim().length > 0;
  const hasCustom =
    emp.customValues !== null &&
    typeof emp.customValues === "object" &&
    !Array.isArray(emp.customValues) &&
    Object.keys(emp.customValues as Record<string, unknown>).length > 0;
  return hasPhone || hasEmergency || hasCustom;
}

/**
 * Evaluates (dryRun=true) or executes (dryRun=false) statutory retention purging & PII redaction.
 * Strictly honors Workspace Legal Hold and WORM immutability guarantees.
 */
export async function evaluateRetentionPurge(
  workspaceId: string,
  dryRun: boolean,
): Promise<RetentionPurgeResult> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, legalHold: true, legalHoldReason: true, retentionPolicies: true },
  });
  if (!ws) throw new Error("Workspace not found.");

  if (ws.legalHold) {
    return {
      blockedByLegalHold: true,
      dryRun,
      counts: { expiredDocs: 0, terminatedPii: 0, oldIncidents: 0 },
    };
  }

  const policy = parseRetentionPolicy(ws.retentionPolicies);
  const now = Date.now();
  const piiCutoff = new Date(now - policy.terminatedPiiDays * DAY_MS);
  const effectiveDocDays = policy.wormLocked
    ? Math.max(policy.i9OshaDays, WORM_STATUTORY_MIN_DAYS)
    : policy.i9OshaDays;
  const docCutoff = new Date(now - effectiveDocDays * DAY_MS);

  const [terminatedCandidates, expiredDocRows] = await Promise.all([
    prisma.employeeProfile.findMany({
      where: {
        workspaceId,
        status: "TERMINATED",
        separationDate: { not: null, lt: piiCutoff },
      },
      select: { id: true, phone: true, emergencyContact: true, customValues: true },
    }),
    prisma.employeeDocument.findMany({
      where: {
        workspaceId,
        expiresAt: { not: null, lt: docCutoff },
      },
      select: { id: true, fileId: true },
    }),
  ]);

  const piiTargets = terminatedCandidates.filter(hasRedactablePii);
  const terminatedPii = piiTargets.length;
  const expiredDocs = expiredDocRows.length;

  if (!dryRun) {
    // Re-check Legal Hold right before performing any destructive or redacting writes
    const latest = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { legalHold: true },
    });
    if (latest?.legalHold) {
      return {
        blockedByLegalHold: true,
        dryRun: false,
        counts: { expiredDocs: 0, terminatedPii: 0, oldIncidents: 0 },
      };
    }

    if (piiTargets.length > 0) {
      await prisma.employeeProfile.updateMany({
        where: { workspaceId, id: { in: piiTargets.map((e) => e.id) } },
        data: {
          phone: null,
          emergencyContact: null,
          customValues: {},
        },
      });
    }

    if (expiredDocRows.length > 0) {
      const docIds = expiredDocRows.map((d) => d.id);
      const candidateFileIds = Array.from(
        new Set(expiredDocRows.map((d) => d.fileId).filter((f): f is string => Boolean(f))),
      );

      await prisma.employeeDocument.deleteMany({
        where: { workspaceId, id: { in: docIds } },
      });

      if (candidateFileIds.length > 0) {
        const stillReferenced = await prisma.employeeDocument.findMany({
          where: { workspaceId, fileId: { in: candidateFileIds } },
          select: { fileId: true },
        });
        const keep = new Set(stillReferenced.map((r) => r.fileId).filter(Boolean));
        const orphanFileIds = candidateFileIds.filter((id) => !keep.has(id));
        if (orphanFileIds.length > 0) {
          await prisma.storedFile.deleteMany({
            where: { workspaceId, id: { in: orphanFileIds } },
          });
        }
      }
    }
  }

  return {
    blockedByLegalHold: false,
    dryRun,
    counts: { expiredDocs, terminatedPii },
  };
}
