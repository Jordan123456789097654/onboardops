"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FileCode2, KeyRound, RefreshCw, Upload } from "lucide-react";
import {
  clearPrevSamlCertAction,
  disableSamlAction,
  enableSamlAction,
  parseSamlMetadataAction,
  removeSamlAction,
  rotateSamlCertAction,
  saveSamlAction,
} from "@/actions/saml";
import { Badge, Field, Modal, useAction, useToast } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export type SamlConfig = {
  entityId: string;
  ssoUrl: string;
  certPem: string;
  prevCertPem: string | null;
  domains: string[];
  roleAttr: string;
  enabled: boolean;
  enforce: boolean;
  testedAt: string | null;
};

export type SamlPanelState = {
  config: SamlConfig | null;
  acsUrl: string;
  spEntityId: string;
  metadataUrl: string;
  workspaceId: string;
  needs: { password: boolean; code: boolean };
  notice?: string;
  error?: string;
};

/** Enterprise SAML 2.0 SSO setup panel (Okta, Ping Identity, OneLogin, ADFS). Owner only. */
export function SamlPanel({ s, isOwner }: { s: SamlPanelState; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const c = s.config;

  const [entityId, setEntityId] = useState(c?.entityId ?? "");
  const [ssoUrl, setSsoUrl] = useState(c?.ssoUrl ?? "");
  const [certPem, setCertPem] = useState(c?.certPem ?? "");
  const [prevCertPem, setPrevCertPem] = useState(c?.prevCertPem ?? "");
  const [domains, setDomains] = useState((c?.domains ?? []).join(", "));
  const [roleAttr, setRoleAttr] = useState(c?.roleAttr ?? "role");
  const [enforce, setEnforce] = useState(c?.enforce ?? false);
  const [metadataXml, setMetadataXml] = useState("");
  const [showXmlImport, setShowXmlImport] = useState(!c);

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  // Zero-downtime cert rotation modal state
  const [rotateOpen, setRotateOpen] = useState(false);
  const [newCertPem, setNewCertPem] = useState("");
  const [rotatePassword, setRotatePassword] = useState("");
  const [rotateCode, setRotateCode] = useState("");

  useEffect(() => {
    if (s.notice === "tested") toast("ok", "Test SAML sign-in succeeded. You can now turn SAML 2.0 SSO on.");
    if (s.error) toast("error", s.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const auth = {
    password: s.needs.password ? password : undefined,
    code: s.needs.code ? code : undefined,
  };
  const authOk = (!s.needs.password || !!password) && (!s.needs.code || !!code);
  const rotateAuthOk = (!s.needs.password || !!rotatePassword) && (!s.needs.code || !!rotateCode);

  const refresh = () => {
    setPassword("");
    setCode("");
    router.refresh();
  };

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value).then(
      () => toast("ok", `${label} copied`),
      () => toast("error", `Could not copy ${label}`),
    );
  }

  function handleXmlFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 512_000) {
      toast("error", "Metadata XML file exceeds the 512 KB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setMetadataXml(text);
      if (text.trim()) {
        exec(() => parseSamlMetadataAction(text), {
          success: "IdP metadata parsed and fields filled",
          onOk: (parsed) => {
            setEntityId(parsed.entityId);
            setSsoUrl(parsed.ssoUrl);
            setCertPem(parsed.certPem);
            if (parsed.extraCertPem) setPrevCertPem(parsed.extraCertPem);
          },
        });
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="card p-4 text-[13px]" id="saml">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" />
          Enterprise SAML 2.0 SSO
          {c?.enabled ? (
            <Badge value="ACTIVE" label="On" />
          ) : c ? (
            <Badge value="PENDING" label="Set up, not on" />
          ) : (
            <Badge value="PENDING" label="Off" />
          )}
        </h2>
        {c?.prevCertPem && <Badge value="ONBOARDING" label="Cert rotation active" />}
      </div>
      <p className="mt-1 text-soft">
        Connect Okta, Ping Identity, OneLogin, Microsoft ADFS, or any SAML 2.0 identity provider. Supports both SP-initiated
        and IdP-initiated HTTP-POST sign-in, XML metadata import, and zero-downtime X.509 certificate rotation. Only existing
        workspace members can sign in.
      </p>

      {!isOwner ? (
        <p className="mt-3 text-xs text-soft">Only the workspace owner can configure SAML 2.0 single sign-on.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Service Provider details for IdP setup */}
          <div className="space-y-2.5 rounded-md border border-line bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-ink">Service Provider (SP) details for your identity provider</div>
              <a
                href={s.metadataUrl}
                download={`onboardops-saml-metadata-${s.workspaceId}.xml`}
                className="btn !h-7 !px-2.5 !text-xs inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download SP Metadata XML
              </a>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2 rounded border border-line bg-surface px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] text-soft">SP Metadata URL</div>
                  <div className="mono truncate text-xs">{s.metadataUrl}</div>
                </div>
                <button type="button" className="btn !h-7 shrink-0 !px-2 !text-xs" onClick={() => copy("SP Metadata URL", s.metadataUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-line bg-surface px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] text-soft">SP Entity ID (Audience URI)</div>
                  <div className="mono truncate text-xs">{s.spEntityId}</div>
                </div>
                <button type="button" className="btn !h-7 shrink-0 !px-2 !text-xs" onClick={() => copy("SP Entity ID", s.spEntityId)}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-line bg-surface px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] text-soft">Assertion Consumer Service (ACS) URL — HTTP-POST</div>
                  <div className="mono truncate text-xs">{s.acsUrl}</div>
                </div>
                <button type="button" className="btn !h-7 shrink-0 !px-2 !text-xs" onClick={() => copy("ACS URL", s.acsUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* IdP Metadata XML import */}
          <div className="rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium text-ink hover:text-accent"
                onClick={() => setShowXmlImport((v) => !v)}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                {showXmlImport ? "Hide IdP Metadata XML import" : "Import from IdP Metadata XML (Okta, Ping, OneLogin, ADFS)"}
              </button>
              <label className="btn !h-7 cursor-pointer !px-2.5 !text-xs inline-flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload .xml
                <input
                  type="file"
                  accept=".xml,application/xml,text/xml"
                  className="hidden"
                  onChange={(e) => {
                    setShowXmlImport(true);
                    handleXmlFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {showXmlImport && (
              <div className="mt-2.5 space-y-2">
                <textarea
                  className="input mono min-h-[88px] text-xs"
                  placeholder="Paste your Identity Provider Metadata XML (<EntityDescriptor ...>)"
                  value={metadataXml}
                  onChange={(e) => setMetadataXml(e.target.value)}
                />
                <button
                  type="button"
                  className="btn !h-8 !text-xs"
                  disabled={pending || metadataXml.trim().length < 20}
                  onClick={() =>
                    exec(() => parseSamlMetadataAction(metadataXml), {
                      success: "IdP metadata parsed and fields filled",
                      onOk: (parsed) => {
                        setEntityId(parsed.entityId);
                        setSsoUrl(parsed.ssoUrl);
                        setCertPem(parsed.certPem);
                        if (parsed.extraCertPem) setPrevCertPem(parsed.extraCertPem);
                      },
                    })
                  }
                >
                  Parse XML Metadata
                </button>
              </div>
            )}
          </div>

          {/* Manual IdP fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="IdP Entity ID (Issuer)">
              <input
                className="input mono"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="http://www.okta.com/exk..."
                autoComplete="off"
              />
            </Field>
            <Field label="IdP SSO URL (HTTP-Redirect / POST)">
              <input
                className="input mono"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://acme.okta.com/app/.../sso/saml"
                autoComplete="off"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Primary X.509 Signing Certificate (PEM)">
                <textarea
                  className="input mono min-h-[100px] text-xs"
                  value={certPem}
                  onChange={(e) => setCertPem(e.target.value)}
                  placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Previous X.509 Certificate (optional — accepted as fallback during cert rotation)">
                <textarea
                  className="input mono min-h-[72px] text-xs"
                  value={prevCertPem}
                  onChange={(e) => setPrevCertPem(e.target.value)}
                  placeholder="Optional rollover certificate PEM"
                />
              </Field>
            </div>
            <Field label="Allowed email domains (comma separated)">
              <input
                className="input mono"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="acme.com, corp.acme.com"
              />
            </Field>
            <Field label="Role attribute name">
              <input
                className="input mono"
                value={roleAttr}
                onChange={(e) => setRoleAttr(e.target.value)}
                placeholder="role"
              />
            </Field>
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={enforce}
              onChange={(e) => setEnforce(e.target.checked)}
            />
            <span>
              Require SAML SSO for everyone on these domains except owners. Owners can always use a password so a
              misconfigured IdP cannot lock you out.
            </span>
          </label>

          {(s.needs.password || s.needs.code) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {s.needs.password && (
                <Field label="Your password">
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              )}
              {s.needs.code && (
                <Field label="Authenticator code">
                  <input
                    className="input mono"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    maxLength={14}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={
                pending ||
                !authOk ||
                entityId.trim().length < 3 ||
                ssoUrl.trim().length < 8 ||
                certPem.trim().length < 40 ||
                !domains.trim()
              }
              onClick={() =>
                exec(
                  () =>
                    saveSamlAction({
                      entityId,
                      ssoUrl,
                      certPem,
                      prevCertPem: prevCertPem.trim() || undefined,
                      metadataXml: metadataXml.trim() || undefined,
                      domains,
                      roleAttr,
                      enforce,
                      ...auth,
                    }),
                  { success: "SAML configuration saved", onOk: refresh },
                )
              }
            >
              Save
            </button>

            {c && (
              <a className="btn" href={`/api/auth/saml/start?test=1&ws=${encodeURIComponent(s.workspaceId)}`}>
                Test SAML Sign-In
              </a>
            )}

            {c && (
              <button
                type="button"
                className="btn inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() => {
                  setNewCertPem("");
                  setRotatePassword(password);
                  setRotateCode(code);
                  setRotateOpen(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rotate Certificate
              </button>
            )}

            {c?.prevCertPem && (
              <button
                type="button"
                className="btn"
                disabled={pending || !authOk}
                onClick={() =>
                  exec(() => clearPrevSamlCertAction(auth), {
                    success: "Previous fallback certificate cleared",
                    onOk: () => {
                      setPrevCertPem("");
                      refresh();
                    },
                  })
                }
              >
                Clear Previous Cert
              </button>
            )}

            {c && !c.enabled && (
              <button
                type="button"
                className="btn"
                disabled={pending || !authOk || !c.testedAt}
                title={c.testedAt ? undefined : "Run a successful test SAML sign-in first"}
                onClick={() =>
                  exec(() => enableSamlAction(auth), { success: "SAML 2.0 SSO is on", onOk: refresh })
                }
              >
                Turn on
              </button>
            )}

            {c?.enabled && (
              <button
                type="button"
                className="btn"
                disabled={pending || !authOk}
                onClick={() =>
                  exec(() => disableSamlAction(auth), { success: "SAML 2.0 SSO is off", onOk: refresh })
                }
              >
                Turn off
              </button>
            )}

            {c && (
              <button
                type="button"
                className="btn-danger"
                disabled={pending || !authOk}
                onClick={() => {
                  if (confirm("Remove SAML 2.0 SSO and delete stored IdP certificates?")) {
                    exec(() => removeSamlAction(auth), { success: "SAML configuration removed", onOk: refresh });
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>

          {c && (
            <p className="text-xs text-soft">
              {c.testedAt
                ? `Last successful SAML test ${fmtDateTime(c.testedAt)}.`
                : "Not tested yet. Complete a successful test SAML sign-in before turning SAML SSO on."}{" "}
              Changing the Entity ID, SSO URL, primary certificate (outside Rotate Certificate), or allowed domains turns
              SAML off until tested again.
            </p>
          )}
        </div>
      )}

      {/* Zero-downtime Certificate Rotation Modal */}
      <Modal open={rotateOpen} onClose={() => setRotateOpen(false)} title="Rotate SAML X.509 Certificate">
        <div className="space-y-3 text-[13px]">
          <p className="text-soft">
            Paste the new signing certificate from your identity provider. Your current certificate will automatically move
            to the fallback slot so SAML assertions signed with either certificate stay valid during IdP rollover — zero
            downtime.
          </p>
          <Field label="New Primary X.509 Certificate (PEM)">
            <textarea
              className="input mono min-h-[120px] text-xs"
              value={newCertPem}
              onChange={(e) => setNewCertPem(e.target.value)}
              placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
            />
          </Field>
          {(s.needs.password || s.needs.code) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {s.needs.password && (
                <Field label="Your password">
                  <input
                    className="input"
                    type="password"
                    value={rotatePassword}
                    onChange={(e) => setRotatePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              )}
              {s.needs.code && (
                <Field label="Authenticator code">
                  <input
                    className="input mono"
                    value={rotateCode}
                    onChange={(e) => setRotateCode(e.target.value)}
                    autoComplete="one-time-code"
                    maxLength={14}
                  />
                </Field>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={() => setRotateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={pending || !rotateAuthOk || newCertPem.trim().length < 40}
              onClick={() =>
                exec(
                  () =>
                    rotateSamlCertAction({
                      certPem: newCertPem,
                      password: s.needs.password ? rotatePassword : undefined,
                      code: s.needs.code ? rotateCode : undefined,
                    }),
                  {
                    success: "Certificate rotated with zero downtime",
                    onOk: () => {
                      setPrevCertPem(certPem);
                      setCertPem(newCertPem);
                      setRotateOpen(false);
                      setNewCertPem("");
                      setRotatePassword("");
                      setRotateCode("");
                      router.refresh();
                    },
                  },
                )
              }
            >
              Rotate Certificate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
