"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Copy, Shield } from "lucide-react";
import { removeDuoAction, saveDuoAction, testDuoHealthAction } from "@/actions/duo";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import type { DuoPublicConfig } from "@/lib/duo";
import { fmtDateTime } from "@/lib/utils";

export type DuoPanelState = {
  config: DuoPublicConfig;
  redirectUri: string;
};

/** Duo Security Universal Prompt (OIDC v4) workspace MFA configuration card. */
export function DuoPanel({ s }: { s: DuoPanelState }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const c = s.config;

  const [apiHost, setApiHost] = useState(c.apiHost);
  const [clientId, setClientId] = useState(c.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(c.enabled);
  const [lastHealthyAt, setLastHealthyAt] = useState<string | null>(null);

  function copyRedirect() {
    navigator.clipboard?.writeText(s.redirectUri).then(
      () => toast("ok", "Duo Redirect URI copied"),
      () => toast("error", "Could not copy Redirect URI"),
    );
  }

  const canSave =
    !pending &&
    apiHost.trim().length >= 5 &&
    clientId.trim().length >= 5 &&
    (c.configured || clientSecret.trim().length > 0);

  const canTest =
    !pending &&
    (apiHost.trim().length >= 5 || c.configured) &&
    (clientId.trim().length >= 5 || c.configured) &&
    (clientSecret.trim().length > 0 || c.configured);

  return (
    <div className="card p-4 text-[13px]" id="duo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="h-4 w-4" />
          Duo Security Universal Prompt MFA
          {c.configured && c.enabled ? (
            <Badge value="ACTIVE" label="Enabled" />
          ) : c.configured ? (
            <Badge value="PENDING" label="Configured, off" />
          ) : (
            <Badge value="PENDING" label="Off" />
          )}
        </h2>
        {lastHealthyAt && <Badge value="ACTIVE" label={`Healthy (${lastHealthyAt})`} />}
      </div>
      <p className="mt-1 text-soft">
        Enforce Duo Security Universal Prompt (OIDC Web SDK v4) as a second factor when members sign in to this workspace.
        Create a Web SDK application in the Duo Admin Panel, add the redirect URI below, and paste your credentials.
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded-md border border-line bg-muted p-3">
          <div className="text-xs text-soft">Add this Redirect URI to your Duo Universal Prompt Web SDK application</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="mono break-all text-xs">{s.redirectUri}</div>
            <button type="button" className="btn !h-7 shrink-0 !px-2 !text-xs" onClick={copyRedirect}>
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Duo API Hostname">
            <input
              className="input mono"
              value={apiHost}
              onChange={(e) => setApiHost(e.target.value)}
              placeholder="api-1234abcd.duosecurity.com"
              autoComplete="off"
            />
          </Field>
          <Field label="Client ID">
            <input
              className="input mono"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="DIXXXXXXXXXXXXXXXXXX"
              autoComplete="off"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={c.configured ? "Client Secret (leave blank to keep saved secret)" : "Client Secret"}>
              <input
                className="input mono"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={c.configured ? "Saved encrypted. Never shown again." : "Enter Duo Client Secret"}
              />
            </Field>
          </div>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            Enable Duo Security MFA for this workspace. Members will be prompted to verify with Duo Security on sign-in
            after password or SSO authentication.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!canSave}
            onClick={() =>
              exec(
                () =>
                  saveDuoAction({
                    apiHost,
                    clientId,
                    clientSecret: clientSecret.trim() || undefined,
                    enabled,
                  }),
                {
                  success: "Duo Security settings saved",
                  onOk: () => {
                    setClientSecret("");
                    router.refresh();
                  },
                },
              )
            }
          >
            Save
          </button>

          <button
            type="button"
            className="btn inline-flex items-center gap-1.5"
            disabled={!canTest}
            onClick={() =>
              exec(
                () =>
                  testDuoHealthAction({
                    apiHost: apiHost.trim() || undefined,
                    clientId: clientId.trim() || undefined,
                    clientSecret: clientSecret.trim() || undefined,
                  }),
                {
                  success: "Duo Security health check succeeded",
                  onOk: (data) => {
                    setLastHealthyAt(
                      data.timestamp
                        ? new Date(data.timestamp * 1000).toISOString().slice(11, 19) + "Z"
                        : "OK",
                    );
                  },
                },
              )
            }
          >
            <Activity className="h-3.5 w-3.5" />
            Test Duo Health Check
          </button>

          {c.configured && (
            <button
              type="button"
              className="btn-danger"
              disabled={pending}
              onClick={() => {
                if (confirm("Remove Duo Security configuration and delete the stored client secret?")) {
                  exec(() => removeDuoAction(), {
                    success: "Duo Security configuration removed",
                    onOk: () => {
                      setApiHost("");
                      setClientId("");
                      setClientSecret("");
                      setEnabled(false);
                      setLastHealthyAt(null);
                      router.refresh();
                    },
                  });
                }
              }}
            >
              Remove
            </button>
          )}
        </div>

        {c.configured && c.updatedAt && (
          <p className="text-xs text-soft">Last updated {fmtDateTime(c.updatedAt)}.</p>
        )}
      </div>
    </div>
  );
}
