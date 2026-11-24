"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Eye, Globe, Lock, Play, Scale, ShieldAlert, Unlock } from "lucide-react";
import {
  runRetentionPurgeAction,
  saveDataResidencyAction,
  saveRetentionPoliciesAction,
  toggleWorkspaceLegalHoldAction,
} from "@/actions/governance";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import type { DataRegion, RetentionPolicy, RetentionPurgeResult } from "@/lib/retention";
import { fmtDateTime } from "@/lib/utils";

export type GovernanceState = {
  dataRegion: string;
  singleTenantRef: string | null;
  legalHold: boolean;
  legalHoldReason: string;
  legalHoldAt: string | null;
  retention: RetentionPolicy;
};

const REGION_OPTIONS: { value: DataRegion; label: string }[] = [
  { value: "US", label: "US — United States (Virginia)" },
  { value: "EU", label: "EU — European Union (Frankfurt)" },
  { value: "UK", label: "UK — United Kingdom (London)" },
  { value: "CA", label: "CA — Canada (Montreal)" },
];

function fmtYears(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "—";
  return `≈ ${(days / 365).toFixed(1)} yrs`;
}

function normalizeRegion(r: string): DataRegion {
  return r === "EU" || r === "UK" || r === "CA" ? r : "US";
}

export function GovernancePanel({
  state,
  isOwner,
}: {
  state: GovernanceState;
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();

  // Section 1: Data Residency & Single-Tenant Pinning
  const [dataRegion, setDataRegion] = useState<DataRegion>(normalizeRegion(state.dataRegion));
  const [singleTenantRef, setSingleTenantRef] = useState(state.singleTenantRef ?? "");

  // Section 2: Workspace Legal Hold
  const [legalHold, setLegalHold] = useState(state.legalHold);
  const [legalHoldReason, setLegalHoldReason] = useState(state.legalHoldReason);
  const [legalHoldAt, setLegalHoldAt] = useState(state.legalHoldAt);
  const [confirmReleaseHold, setConfirmReleaseHold] = useState(false);

  // Section 3: WORM Retention & Automated Purge
  const [policy, setPolicy] = useState<RetentionPolicy>(state.retention);
  const [wormLockedPersisted, setWormLockedPersisted] = useState(state.retention.wormLocked);
  const [lockedFloor, setLockedFloor] = useState<RetentionPolicy>(state.retention);
  const [previewResult, setPreviewResult] = useState<(RetentionPurgeResult & { summary: string }) | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  function handleSaveResidency(e: React.FormEvent) {
    e.preventDefault();
    exec(
      () => saveDataResidencyAction({ dataRegion, singleTenantRef: singleTenantRef.trim() || null }),
      {
        success: "Data residency & tenant pinning saved",
        onOk: (res) => {
          setDataRegion(res.dataRegion);
          setSingleTenantRef(res.singleTenantRef ?? "");
          router.refresh();
        },
      },
    );
  }

  function handleEnableLegalHold(e: React.FormEvent) {
    e.preventDefault();
    exec(
      () => toggleWorkspaceLegalHoldAction({ enabled: true, reason: legalHoldReason }),
      {
        success: "Workspace placed under Legal Hold",
        onOk: (res) => {
          setLegalHold(res.legalHold);
          setLegalHoldReason(res.legalHoldReason);
          setLegalHoldAt(res.legalHoldAt);
          setConfirmPurge(false);
          router.refresh();
        },
      },
    );
  }

  function handleReleaseLegalHold() {
    exec(
      () => toggleWorkspaceLegalHoldAction({ enabled: false, reason: "" }),
      {
        success: "Workspace Legal Hold released",
        onOk: (res) => {
          setLegalHold(res.legalHold);
          setLegalHoldReason(res.legalHoldReason);
          setLegalHoldAt(res.legalHoldAt);
          setConfirmReleaseHold(false);
          router.refresh();
        },
      },
    );
  }

  function handleSaveRetention(e: React.FormEvent) {
    e.preventDefault();
    exec(
      () =>
        saveRetentionPoliciesAction({
          wormLocked: policy.wormLocked,
          i9OshaDays: policy.i9OshaDays,
          disciplineDays: policy.disciplineDays,
          trainingDays: policy.trainingDays,
          policiesDays: policy.policiesDays,
          terminatedPiiDays: policy.terminatedPiiDays,
        }),
      {
        success: policy.wormLocked && !wormLockedPersisted
          ? "WORM immutable retention lock activated"
          : "Retention policies saved",
        onOk: (saved) => {
          setPolicy(saved);
          setWormLockedPersisted(saved.wormLocked);
          setLockedFloor(saved);
          router.refresh();
        },
      },
    );
  }

  function handleDryRun() {
    exec(() => runRetentionPurgeAction({ dryRun: true }), {
      onOk: (res) => {
        setPreviewResult(res);
        if (res.blockedByLegalHold) {
          toast("error", "Purge preview blocked: workspace is under an active Legal Hold.");
        } else {
          setPolicy((prev) => ({
            ...prev,
            lastPurgeAt: new Date().toISOString(),
            lastPurgeSummary: res.summary,
          }));
          toast("ok", res.summary);
        }
        router.refresh();
      },
    });
  }

  function handleExecutePurge() {
    exec(() => runRetentionPurgeAction({ dryRun: false }), {
      onOk: (res) => {
        setPreviewResult(res);
        setConfirmPurge(false);
        if (res.blockedByLegalHold) {
          toast("error", "Statutory purge blocked by active Legal Hold.");
        } else {
          setPolicy((prev) => ({
            ...prev,
            lastPurgeAt: new Date().toISOString(),
            lastPurgeSummary: res.summary,
          }));
          toast("ok", res.summary);
        }
        router.refresh();
      },
    });
  }

  const retentionFields: { key: keyof Pick<RetentionPolicy, "i9OshaDays" | "disciplineDays" | "trainingDays" | "policiesDays" | "terminatedPiiDays">; label: string; hint: string }[] = [
    { key: "i9OshaDays", label: "I-9 & OSHA Documents (days)", hint: "Default 1,825d (5 yrs)" },
    { key: "disciplineDays", label: "Disciplinary & Investigation Records (days)", hint: "Default 2,555d (7 yrs)" },
    { key: "trainingDays", label: "Training & Certifications (days)", hint: "Default 1,825d (5 yrs)" },
    { key: "policiesDays", label: "Policy Acknowledgments (days)", hint: "Default 2,555d (7 yrs)" },
    { key: "terminatedPiiDays", label: "Terminated Employee PII Redaction (days)", hint: "Default 1,095d (3 yrs)" },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Data Residency & Single-Tenant Pinning */}
      <div className="card p-4 text-[13px]" id="data-residency">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4" />
            Data Residency &amp; Single-Tenant Pinning
            <Badge value="ACTIVE" label={dataRegion} />
          </h2>
          {singleTenantRef && (
            <span className="mono text-xs text-soft">Shard: {singleTenantRef}</span>
          )}
        </div>

        <p className="mt-1 text-soft">
          Pin workspace storage and compliance exports to a sovereign data region and optionally assign a dedicated
          single-tenant database shard reference for enterprise isolation attestations.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleSaveResidency}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Primary Data Residency Region">
              <select
                className="input"
                value={dataRegion}
                disabled={!isOwner || pending}
                onChange={(e) => setDataRegion(e.target.value as DataRegion)}
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dedicated Tenant Shard ID (optional)">
              <input
                className="input mono"
                value={singleTenantRef}
                disabled={!isOwner || pending}
                onChange={(e) => setSingleTenantRef(e.target.value)}
                placeholder="e.g. shard-eu-acme-01"
                maxLength={120}
              />
            </Field>
          </div>

          {isOwner ? (
            <button type="submit" className="btn-primary" disabled={pending}>
              Save residency &amp; pinning
            </button>
          ) : (
            <p className="text-xs text-soft">Only the workspace owner can modify data residency or tenant pinning.</p>
          )}
        </form>
      </div>

      {/* 2. Workspace Legal Hold */}
      <div
        className={`card p-4 text-[13px] ${
          legalHold ? "border-rose-300 dark:border-rose-900" : ""
        }`}
        id="legal-hold"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4" />
            Workspace Legal Hold
            {legalHold ? (
              <Badge value="SUSPENDED" label="LEGAL HOLD ACTIVE" />
            ) : (
              <Badge value="PENDING" label="Inactive" />
            )}
          </h2>
          {legalHold && legalHoldAt && (
            <span className="mono text-xs text-soft">Active since {fmtDateTime(legalHoldAt)}</span>
          )}
        </div>

        <p className="mt-1 text-soft">
          Freeze all automated retention purges, PII redactions, destructive deletions, and workspace closure while
          litigation, regulatory audits, or preservation notices are active.
        </p>

        {legalHold ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2.5 rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold">
                  Preservation freeze is active — deletions, purges, and workspace closure are blocked.
                </div>
                <div className="text-xs">
                  Matter / Reason: <span className="font-medium">{legalHoldReason || "Not specified"}</span>
                </div>
              </div>
            </div>

            {!confirmReleaseHold ? (
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => setConfirmReleaseHold(true)}
              >
                <Unlock className="h-3.5 w-3.5" />
                Release Legal Hold…
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                <span>
                  Confirm releasing Legal Hold? Statutory purge &amp; workspace closure restrictions will be lifted and
                  logged in the audit trail.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-danger !h-7 !px-2.5 !text-xs"
                    disabled={pending}
                    onClick={handleReleaseLegalHold}
                  >
                    Confirm release
                  </button>
                  <button
                    type="button"
                    className="btn !h-7 !px-2.5 !text-xs"
                    disabled={pending}
                    onClick={() => setConfirmReleaseHold(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={handleEnableLegalHold}>
            <Field label="Legal Hold Reason / Matter Reference">
              <input
                className="input"
                value={legalHoldReason}
                onChange={(e) => setLegalHoldReason(e.target.value)}
                placeholder="e.g. EEOC Inquiry #2026-0412 — preserve all HR and safety records"
                maxLength={500}
              />
            </Field>
            <button
              type="submit"
              className="btn-danger"
              disabled={pending || legalHoldReason.trim().length < 3}
            >
              <Lock className="h-3.5 w-3.5" />
              Activate Workspace Legal Hold
            </button>
          </form>
        )}
      </div>

      {/* 3. WORM Immutable Retention & Automated Purge */}
      <div className="card p-4 text-[13px]" id="worm-retention">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Archive className="h-4 w-4" />
            WORM Immutable Retention &amp; Automated Purge
            {wormLockedPersisted ? (
              <Badge value="ACTIVE" label="WORM Locked" />
            ) : (
              <Badge value="PENDING" label="Editable" />
            )}
          </h2>
          {policy.lastPurgeAt && (
            <span className="mono text-xs text-soft">Last run {fmtDateTime(policy.lastPurgeAt)}</span>
          )}
        </div>

        <p className="mt-1 text-soft">
          Configure statutory retention windows per compliance category. When WORM lock is enabled, retention windows
          become write-once / extend-only and cannot be shortened or unlocked. Automated purge redacts terminated
          employee PII while preserving anonymized audit trails and removes expired documents past their statutory
          window.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSaveRetention}>
          <div className="grid gap-3 sm:grid-cols-2">
            {retentionFields.map(({ key, label, hint }) => {
              const minVal = wormLockedPersisted ? lockedFloor[key] : 30;
              return (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      className="input mono"
                      type="number"
                      min={minVal}
                      max={36500}
                      disabled={!isOwner || pending}
                      value={policy[key]}
                      onChange={(e) =>
                        setPolicy((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                    <span className="mono shrink-0 text-xs text-soft">{fmtYears(policy[key])}</span>
                  </div>
                  <span className="mt-1 block text-xs text-soft">
                    {wormLockedPersisted ? `WORM floor: ${minVal} days (extend-only)` : hint}
                  </span>
                </Field>
              );
            })}
          </div>

          <div className="rounded-md border border-line bg-muted/50 p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={policy.wormLocked}
                disabled={!isOwner || pending || wormLockedPersisted}
                onChange={(e) => setPolicy((prev) => ({ ...prev, wormLocked: e.target.checked }))}
              />
              <span>
                <span className="font-medium text-ink">Enable WORM Immutable Retention Lock</span>
                <span className="mt-0.5 block text-xs text-soft">
                  {wormLockedPersisted
                    ? "WORM lock is permanently enabled for this workspace. Retention periods can only be lengthened."
                    : "Once saved, retention windows can only be lengthened — never shortened — and WORM lock cannot be disabled."}
                </span>
              </span>
            </label>
          </div>

          {isOwner ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={pending}>
                Save retention policy
              </button>
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={handleDryRun}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview Purge (Dry Run)
              </button>
              {!confirmPurge ? (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={pending || legalHold}
                  title={
                    legalHold
                      ? "Disabled while Workspace Legal Hold is active"
                      : "Execute statutory purge & terminated PII redaction"
                  }
                  onClick={() => setConfirmPurge(true)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Statutory Purge
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                  <span>Redact eligible terminated PII &amp; delete past-statutory expired docs?</span>
                  <button
                    type="button"
                    className="btn-danger !h-6 !px-2 !text-xs"
                    disabled={pending || legalHold}
                    onClick={handleExecutePurge}
                  >
                    Confirm purge
                  </button>
                  <button
                    type="button"
                    className="btn !h-6 !px-2 !text-xs"
                    disabled={pending}
                    onClick={() => setConfirmPurge(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-soft">
              Only the workspace owner can modify retention policies or execute statutory purges.
            </p>
          )}
        </form>

        {legalHold && isOwner && (
          <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
            Statutory purge execution is disabled while Workspace Legal Hold is active.
          </p>
        )}

        {previewResult && (
          <div className="mt-3 rounded-md border border-line bg-muted/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
              <span>{previewResult.dryRun ? "Dry Run Preview Result" : "Statutory Purge Result"}</span>
              <Badge
                value={previewResult.blockedByLegalHold ? "SUSPENDED" : "PASSED"}
                label={previewResult.blockedByLegalHold ? "Blocked by Legal Hold" : previewResult.dryRun ? "Dry Run" : "Completed"}
              />
            </div>
            <p className="mt-1 text-soft">{previewResult.summary}</p>
            {!previewResult.blockedByLegalHold && (
              <div className="mt-2 flex flex-wrap gap-4 mono text-soft">
                <span>
                  Expired documents: <strong className="text-ink">{previewResult.counts.expiredDocs}</strong>
                </span>
                <span>
                  Terminated PII records: <strong className="text-ink">{previewResult.counts.terminatedPii}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {policy.lastPurgeSummary && (
          <p className="mt-3 border-t border-line pt-2.5 text-xs text-soft">
            Last recorded run{policy.lastPurgeAt ? ` (${fmtDateTime(policy.lastPurgeAt)})` : ""}:{" "}
            <span className="text-ink">{policy.lastPurgeSummary}</span>
          </p>
        )}
      </div>
    </div>
  );
}
