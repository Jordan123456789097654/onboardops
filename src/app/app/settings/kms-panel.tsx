"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Cloud, RefreshCw, Trash2 } from "lucide-react";
import {
  removeCloudKmsAction,
  rotateCloudKmsEnvelopeAction,
  saveCloudKmsAction,
  testCloudKmsAction,
  type CloudKmsProvider,
  type CloudKmsPublicConfig,
} from "@/actions/kms";
import { Badge, Field, useAction } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type { CloudKmsProvider, CloudKmsPublicConfig };

const PROVIDER_META: Record<
  CloudKmsProvider,
  {
    label: string;
    keyLabel: string;
    keyPlaceholder: string;
    regionPlaceholder: string;
    principalLabel: string;
    principalPlaceholder: string;
    credentialsPlaceholder: string;
  }
> = {
  aws_kms: {
    label: "AWS KMS",
    keyLabel: "AWS KMS Key ARN",
    keyPlaceholder: "arn:aws:kms:us-east-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab",
    regionPlaceholder: "us-east-1",
    principalLabel: "IAM Role ARN (optional)",
    principalPlaceholder: "arn:aws:iam::123456789012:role/OnboardOpsKmsEnvelope",
    credentialsPlaceholder: '{"accessKeyId":"...","secretAccessKey":"..."} (optional — sealed with AES-256-GCM)',
  },
  gcp_kms: {
    label: "Google Cloud KMS",
    keyLabel: "Cloud KMS CryptoKey Resource Path",
    keyPlaceholder: "projects/acme-prod/locations/us-east1/keyRings/onboardops/cryptoKeys/workspace-kek",
    regionPlaceholder: "us-east1",
    principalLabel: "Service Account / WIF Principal (optional)",
    principalPlaceholder: "onboardops-kms@acme-prod.iam.gserviceaccount.com",
    credentialsPlaceholder: '{"type":"service_account","project_id":"..."} (optional — sealed with AES-256-GCM)',
  },
  azure_key_vault: {
    label: "Azure Key Vault",
    keyLabel: "Azure Key Vault Key URI",
    keyPlaceholder: "https://acme-prod-kv.vault.azure.net/keys/onboardops-kek",
    regionPlaceholder: "eastus",
    principalLabel: "Managed Identity / App Client ID (optional)",
    principalPlaceholder: "11111111-2222-3333-4444-555555555555",
    credentialsPlaceholder: '{"tenantId":"...","clientId":"...","clientSecret":"..."} (optional — sealed with AES-256-GCM)',
  },
};

export function KmsPanel({
  config,
  isOwner,
}: {
  config: CloudKmsPublicConfig;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();

  const [provider, setProvider] = useState<CloudKmsProvider>(config.provider);
  const [keyUri, setKeyUri] = useState(config.keyUri);
  const [region, setRegion] = useState(config.region);
  const [authPrincipal, setAuthPrincipal] = useState(config.authPrincipal);
  const [credentials, setCredentials] = useState("");
  const [enabled, setEnabled] = useState(config.configured ? config.enabled : true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const meta = PROVIDER_META[provider];

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    exec(
      () =>
        saveCloudKmsAction({
          provider,
          keyUri,
          region,
          authPrincipal,
          credentials: credentials || undefined,
          enabled,
        }),
      {
        success: "Cloud KMS envelope configuration saved",
        onOk: (updated) => {
          setProvider(updated.provider);
          setKeyUri(updated.keyUri);
          setRegion(updated.region);
          setAuthPrincipal(updated.authPrincipal);
          setEnabled(updated.enabled);
          setCredentials("");
          setConfirmRemove(false);
          router.refresh();
        },
      },
    );
  }

  function handleVerify() {
    exec(() => testCloudKmsAction(), {
      success: "Cloud KMS key URI and envelope configuration verified",
      onOk: () => router.refresh(),
    });
  }

  function handleRotate() {
    exec(() => rotateCloudKmsEnvelopeAction(), {
      success: `Rotated Cloud KMS envelope to v${config.envelopeVersion + 1}`,
      onOk: () => router.refresh(),
    });
  }

  function handleRemove() {
    exec(() => removeCloudKmsAction(), {
      success: "Cloud KMS configuration removed",
      onOk: () => {
        setKeyUri("");
        setRegion("");
        setAuthPrincipal("");
        setCredentials("");
        setEnabled(true);
        setConfirmRemove(false);
        router.refresh();
      },
    });
  }

  return (
    <div className="card p-4 text-[13px]" id="cloud-kms">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Cloud className="h-4 w-4" />
          Cloud KMS Envelope Encryption
          {config.configured && config.enabled ? (
            <Badge value="ACTIVE" label={`Active · v${config.envelopeVersion}`} />
          ) : config.configured ? (
            <Badge value="PENDING" label={`Paused · v${config.envelopeVersion}`} />
          ) : (
            <Badge value="PENDING" label="Not configured" />
          )}
        </h2>
        {config.configured && (
          <span className="mono text-xs text-soft">{PROVIDER_META[config.provider].label}</span>
        )}
      </div>

      <p className="mt-1 text-soft">
        Complement your workspace CMK by binding key-envelope metadata and rotation policy to an external enterprise
        KMS (AWS KMS, Google Cloud KMS, or Azure Key Vault). Optional credentials are sealed with AES-256-GCM and
        never returned to the browser.
      </p>

      {config.configured && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-line bg-muted/60 px-3 py-2 text-xs text-soft">
          <span>
            Envelope version: <strong className="mono text-ink">v{config.envelopeVersion}</strong>
          </span>
          <span>
            Region: <strong className="mono text-ink">{config.region || "—"}</strong>
          </span>
          <span>
            Last verified:{" "}
            <strong className="mono text-ink">
              {config.lastVerifiedAt ? fmtDateTime(config.lastVerifiedAt) : "Not verified"}
            </strong>
          </span>
          <span>
            Last rotated:{" "}
            <strong className="mono text-ink">
              {config.lastRotatedAt ? fmtDateTime(config.lastRotatedAt) : "Never"}
            </strong>
          </span>
        </div>
      )}

      {!isOwner ? (
        <p className="mt-3 text-xs text-soft">
          Only the workspace owner can configure, verify, or rotate Cloud KMS envelope settings.
        </p>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cloud KMS Provider">
              <select
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value as CloudKmsProvider)}
              >
                {(Object.keys(PROVIDER_META) as CloudKmsProvider[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_META[p].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Region / Location">
              <input
                className="input mono"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={meta.regionPlaceholder}
                maxLength={80}
              />
            </Field>
          </div>

          <Field label={meta.keyLabel}>
            <input
              className="input mono"
              value={keyUri}
              onChange={(e) => setKeyUri(e.target.value)}
              placeholder={meta.keyPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field label={meta.principalLabel}>
            <input
              className="input mono"
              value={authPrincipal}
              onChange={(e) => setAuthPrincipal(e.target.value)}
              placeholder={meta.principalPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field
            label={
              config.configured
                ? "Credentials JSON / Secret (optional — leave blank to keep saved)"
                : "Credentials JSON / Secret (optional)"
            }
          >
            <textarea
              className="textarea mono"
              rows={2}
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder={meta.credentialsPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <label className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable Cloud KMS envelope policy for this workspace.</span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={pending || !keyUri.trim()}>
              Save KMS config
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending || !config.configured}
              onClick={handleVerify}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verify config
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending || !config.configured}
              onClick={handleRotate}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rotate envelope (v{config.envelopeVersion} → v{config.envelopeVersion + 1})
            </button>
            {config.configured && !confirmRemove && (
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
            {config.configured && confirmRemove && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
                <span>Clear Cloud KMS config &amp; sealed credentials?</span>
                <button type="button" className="btn-danger !h-6 !px-2 !text-xs" disabled={pending} onClick={handleRemove}>
                  Confirm
                </button>
                <button type="button" className="btn !h-6 !px-2 !text-xs" disabled={pending} onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
