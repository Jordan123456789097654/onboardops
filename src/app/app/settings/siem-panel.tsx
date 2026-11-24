"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Send, Trash2 } from "lucide-react";
import { removeSiemAction, saveSiemAction, testSiemAction } from "@/actions/siem";
import { Badge, Field, useAction, useToast } from "@/components/ui";
import type { SiemProvider, SiemPublicConfig } from "@/lib/siem";
import { fmtDateTime } from "@/lib/utils";

export type SiemDeliveryRow = {
  id: string;
  provider: string;
  ok: boolean;
  statusCode: number | null;
  eventCount: number;
  error: string | null;
  createdAt: string;
};

const PROVIDER_META: Record<
  SiemProvider,
  { label: string; endpointPlaceholder: string; tokenLabel: string; hint: string }
> = {
  splunk: {
    label: "Splunk HEC",
    endpointPlaceholder: "https://http-inputs-acme.splunkcloud.com:443/services/collector/event",
    tokenLabel: "Splunk HEC Token",
    hint: "Sends JSON events with Authorization: Splunk <token>.",
  },
  datadog: {
    label: "Datadog Logs",
    endpointPlaceholder: "https://http-intake.logs.datadoghq.com/api/v2/logs",
    tokenLabel: "Datadog API Key (DD-API-KEY)",
    hint: "Sends structured log payloads with DD-API-KEY header.",
  },
  sentinel: {
    label: "Microsoft Sentinel",
    endpointPlaceholder: "https://my-dce.eastus-1.ingest.monitor.azure.com/dataCollectionRules/dcr-xxx/streams/Custom-OnboardOps_CL?api-version=2023-01-01",
    tokenLabel: "Bearer Token",
    hint: "Sends JSON log arrays with Authorization: Bearer <token>.",
  },
  crowdstrike: {
    label: "CrowdStrike Falcon LogScale",
    endpointPlaceholder: "https://cloud.community.humio.com/api/v1/ingest/structured",
    tokenLabel: "Ingest Token",
    hint: "Sends structured event envelopes with Authorization: Bearer <token>.",
  },
  webhook: {
    label: "Custom HTTPS SIEM Webhook",
    endpointPlaceholder: "https://siem.example.com/ingest/onboardops",
    tokenLabel: "Bearer Token",
    hint: "Sends normalized audit JSON with Authorization: Bearer <token>.",
  },
};

export function SiemPanel({
  config,
  deliveries,
}: {
  config: SiemPublicConfig;
  deliveries: SiemDeliveryRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();

  const [provider, setProvider] = useState<SiemProvider>(config.provider);
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl);
  const [token, setToken] = useState("");
  const [indexName, setIndexName] = useState(config.indexName);
  const [sourceTag, setSourceTag] = useState(config.sourceTag);
  const [enabled, setEnabled] = useState(config.configured ? config.enabled : true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const meta = PROVIDER_META[provider];

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    exec(
      () =>
        saveSiemAction({
          provider,
          endpointUrl,
          token: token || undefined,
          indexName,
          sourceTag,
          enabled,
        }),
      {
        success: "SIEM streaming settings saved",
        onOk: (updated) => {
          setProvider(updated.provider);
          setEndpointUrl(updated.endpointUrl);
          setIndexName(updated.indexName);
          setSourceTag(updated.sourceTag);
          setEnabled(updated.enabled);
          setToken("");
          setConfirmRemove(false);
          router.refresh();
        },
      },
    );
  }

  function handleTest() {
    exec(() => testSiemAction(), {
      onOk: (res) => {
        if (res.ok) {
          toast("ok", `Test event delivered to ${meta.label} (HTTP ${res.statusCode ?? 200}).`);
        } else {
          toast("error", res.error || "SIEM test delivery failed.");
        }
        router.refresh();
      },
    });
  }

  function handleRemove() {
    exec(() => removeSiemAction(), {
      success: "SIEM configuration removed",
      onOk: () => {
        setEndpointUrl("");
        setToken("");
        setIndexName("");
        setSourceTag("");
        setEnabled(true);
        setConfirmRemove(false);
        router.refresh();
      },
    });
  }

  return (
    <div className="card p-4 text-[13px]" id="siem">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="h-4 w-4" />
          SIEM Log Streaming
          {config.configured && config.enabled ? (
            <Badge value="ACTIVE" label="Streaming" />
          ) : config.configured ? (
            <Badge value="PENDING" label="Paused" />
          ) : (
            <Badge value="PENDING" label="Off" />
          )}
        </h2>
        {config.updatedAt && (
          <span className="text-xs text-soft">Updated {fmtDateTime(config.updatedAt)}</span>
        )}
      </div>

      <p className="mt-1 text-soft">
        Stream tamper-evident workspace audit events in real time to your enterprise SIEM. Credentials are sealed at
        rest with AES-256-GCM and never shown again. Delivery is asynchronous and never blocks audit logging.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSave}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SIEM Provider">
            <select
              className="input"
              value={provider}
              onChange={(e) => setProvider(e.target.value as SiemProvider)}
            >
              {(Object.keys(PROVIDER_META) as SiemProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_META[p].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={config.configured ? `${meta.tokenLabel} (leave blank to keep saved)` : meta.tokenLabel}>
            <input
              className="input mono"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="new-password"
              placeholder={config.configured ? "Sealed token stored — enter to rotate" : "Paste HEC token or API key"}
            />
          </Field>
        </div>

        <Field label="HTTPS Ingestion Endpoint URL">
          <input
            className="input mono"
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder={meta.endpointPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-xs text-soft">
            {meta.hint} Only public <span className="mono">https://</span> hosts are accepted.
          </span>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Index Name (optional)">
            <input
              className="input mono"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              placeholder={provider === "splunk" ? "main" : "Optional"}
              maxLength={120}
            />
          </Field>
          <Field label="Source Tag (optional)">
            <input
              className="input mono"
              value={sourceTag}
              onChange={(e) => setSourceTag(e.target.value)}
              placeholder={provider === "datadog" ? "onboardops" : "onboardops-audit"}
              maxLength={120}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable real-time audit log streaming to this SIEM endpoint.</span>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            className="btn-primary"
            disabled={pending || !endpointUrl.trim() || (!config.configured && !token.trim())}
          >
            Save SIEM config
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending || !config.configured}
            onClick={handleTest}
            title={config.configured ? "Send a synthetic SIEM_TEST_EVENT" : "Save configuration first"}
          >
            <Send className="h-3.5 w-3.5" />
            Send test event
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
              <span>Delete SIEM config &amp; sealed token?</span>
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

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-soft">Recent Delivery Log</h3>
          <span className="text-xs text-soft">{deliveries.length} recent attempt{deliveries.length === 1 ? "" : "s"}</span>
        </div>
        {deliveries.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-xs text-soft">
            No SIEM deliveries recorded yet. Save your configuration and send a test event to verify connectivity.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Provider</th>
                  <th className="th">Status</th>
                  <th className="th">HTTP</th>
                  <th className="th">Events</th>
                  <th className="th">Detail</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/40">
                    <td className="td mono whitespace-nowrap text-xs text-soft">{fmtDateTime(d.createdAt)}</td>
                    <td className="td mono text-xs">{d.provider}</td>
                    <td className="td">
                      <Badge value={d.ok ? "PASSED" : "FAILED"} label={d.ok ? "OK" : "FAILED"} />
                    </td>
                    <td className="td mono text-xs">{d.statusCode ?? "—"}</td>
                    <td className="td mono text-xs">{d.eventCount}</td>
                    <td className="td max-w-[260px] truncate text-xs text-soft" title={d.error ?? "Delivered"}>
                      {d.error ?? "Delivered"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
