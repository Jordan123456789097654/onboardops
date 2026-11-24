"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, ShieldAlert, Trash2, Users } from "lucide-react";
import { createScimTokenAction, revokeScimTokenAction } from "@/actions/scim";
import { Badge, Field, Modal, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type ScimTokenItem = {
  id: string;
  name: string;
  prefix: string;
  createdByName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type CreatedToken = {
  id: string;
  token: string;
  prefix: string;
  name: string;
};

const ENDPOINTS = [
  {
    path: "/Users",
    methods: "GET · POST · PUT · PATCH · DELETE",
    desc: "Provision new hires, update names/titles/emails, and deprovision or reactivate employees.",
  },
  {
    path: "/Groups",
    methods: "GET · POST",
    desc: "Map identity provider groups to OnboardOps departments and attach active staff.",
  },
  {
    path: "/ServiceProviderConfig",
    methods: "GET",
    desc: "RFC 7643 capability discovery (OAuth Bearer auth, PATCH, and attribute filters).",
  },
] as const;

export function ScimPanel({ baseUrl, tokens }: { baseUrl: string; tokens: ScimTokenItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();

  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<CreatedToken | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ScimTokenItem | null>(null);

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const scimBaseUrl = cleanBase.endsWith("/api/scim/v2") ? cleanBase : `${cleanBase}/api/scim/v2`;

  async function copyText(text: string, kind: "url" | "token") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
        toast("ok", "SCIM Base URL copied");
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
        toast("ok", "SCIM bearer token copied");
      }
    } catch {
      toast("error", "Could not access clipboard. Select and copy manually.");
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    exec(() => createScimTokenAction({ name: trimmed }), {
      success: "SCIM bearer token created",
      onOk: (data) => {
        setFresh(data);
        setName("");
        setCopiedToken(false);
        router.refresh();
      },
    });
  }

  return (
    <section className="card space-y-4 p-4 text-[13px]" id="scim">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          SCIM 2.0 Directory Provisioning
          <Badge value={tokens.length > 0 ? "ACTIVE" : "PENDING"} label={tokens.length > 0 ? `${tokens.length} Active` : "Not configured"} />
        </h2>
      </div>

      <p className="text-soft">
        Connect Okta, Microsoft Entra ID, Ping Identity, or OneLogin to automatically provision employees, sync departments,
        and instantly revoke access when someone leaves. Authenticate with{" "}
        <span className="mono text-ink">Authorization: Bearer &lt;token&gt;</span>.
      </p>

      {/* SCIM Base URL */}
      <div className="rounded-lg border border-line bg-muted p-3">
        <div className="text-xs font-medium text-soft">SCIM 2.0 Base URL (Connector URL)</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <code className="mono flex-1 break-all rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
            {scimBaseUrl}
          </code>
          <button
            type="button"
            className="btn shrink-0"
            onClick={() => copyText(scimBaseUrl, "url")}
          >
            {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedUrl ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>

      {/* Supported Endpoints Summary */}
      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-3 py-2 text-xs font-semibold text-soft">
          Supported RFC 7643 / 7644 Endpoints
        </div>
        <div className="divide-y divide-line">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-xs font-semibold text-ink">{ep.path}</span>
                  <span className="mono text-[11px] text-soft">{ep.methods}</span>
                </div>
                <p className="mt-0.5 text-xs text-soft">{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instant Session-Revocation Security Note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <div className="font-semibold">Instant deprovisioning &amp; kill-switch session revocation</div>
          <p className="mt-0.5 leading-relaxed opacity-90">
            Setting <span className="mono">active: false</span> via <span className="mono">PATCH</span>/<span className="mono">PUT</span> or
            calling <span className="mono">DELETE /Users/&#123;id&#125;</span> immediately marks the employee as{" "}
            <span className="font-medium">TERMINATED</span>, revokes every active browser session, and invalidates all existing JWT
            cookies on the very next request. Every event is recorded in the workspace audit log.
          </p>
        </div>
      </div>

      {/* One-Time Bearer Token Reveal Banner */}
      {fresh && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3.5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold">
              <KeyRound className="h-4 w-4 shrink-0" />
              Token &ldquo;{fresh.name}&rdquo; created — copy it now
            </div>
            <button
              type="button"
              className="text-xs underline opacity-80 hover:opacity-100"
              onClick={() => setFresh(null)}
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-xs opacity-90">
            For your security, only a SHA-256 hash is stored. This bearer token will never be displayed again.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="mono flex-1 break-all rounded border border-emerald-300/80 bg-surface px-2.5 py-1.5 text-xs text-ink dark:border-emerald-800">
              {fresh.token}
            </code>
            <button
              type="button"
              className="btn shrink-0"
              onClick={() => copyText(fresh.token, "token")}
            >
              {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedToken ? "Copied" : "Copy token"}
            </button>
          </div>
        </div>
      )}

      {/* Create SCIM Token Form */}
      <form onSubmit={handleCreate} className="rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Create a SCIM bearer token">
              <input
                className="input"
                placeholder="e.g. Okta Production or Microsoft Entra ID"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={pending || name.trim().length < 2}
          >
            {pending ? "Creating…" : "Create token"}
          </button>
        </div>
      </form>

      {/* Active Tokens Table */}
      <div>
        <div className="mb-2 text-xs font-semibold text-soft">
          Active bearer tokens ({tokens.length})
        </div>
        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-soft">
            No active SCIM bearer tokens yet. Create one above to connect your identity provider.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-muted text-soft">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Prefix</th>
                  <th className="px-3 py-2 font-medium">Created by</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Last used</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tokens.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2.5 font-medium text-ink">{t.name}</td>
                    <td className="mono px-3 py-2.5 text-soft">{t.prefix}…</td>
                    <td className="px-3 py-2.5 text-soft">{t.createdByName}</td>
                    <td className="mono px-3 py-2.5 text-soft">{fmtDateTime(t.createdAt)}</td>
                    <td className="mono px-3 py-2.5 text-soft">{t.lastUsedAt ? fmtDateTime(t.lastUsedAt) : "Never"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        className="btn-danger !h-7 !px-2.5 !text-xs"
                        disabled={pending}
                        onClick={() => setRevokeTarget(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke SCIM bearer token"
      >
        {revokeTarget && (
          <div className="space-y-3 text-[13px]">
            <p className="text-soft">
              Revoke <span className="font-semibold text-ink">{revokeTarget.name}</span>{" "}
              (<span className="mono">{revokeTarget.prefix}…</span>)? Any identity provider using this token will
              immediately receive <span className="mono">401 Unauthorized</span> on all SCIM requests.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => setRevokeTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() =>
                  exec(() => revokeScimTokenAction(revokeTarget.id), {
                    success: "SCIM token revoked",
                    onOk: () => {
                      if (fresh?.id === revokeTarget.id) setFresh(null);
                      setRevokeTarget(null);
                      router.refresh();
                    },
                  })
                }
              >
                {pending ? "Revoking…" : "Revoke token"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
