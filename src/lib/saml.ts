import { X509Certificate, createHash, createVerify, randomBytes, timingSafeEqual } from "crypto";
import { deflateRawSync } from "zlib";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { emailDomain } from "./sso";
import { findUserByAnyEmail } from "./user-emails";

/**
 * Enterprise SAML 2.0 Service Provider (Okta, Ping Identity, OneLogin, Microsoft ADFS, Entra ID).
 * Supports SP-initiated and IdP-initiated HTTP-POST SSO, IdP metadata XML import,
 * zero-downtime dual-certificate rotation, W3C Exclusive C14N XMLDSig verification, and XSW defense.
 */

export const SAML_COOKIE = "oo_saml";
export const SAML_TTL_SECONDS = 600;
const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_XML_BYTES = 512 * 1024;

export const SAML_ERRORS: Record<string, string> = {
  state: "That SAML sign-in attempt expired or did not start here. Please try again.",
  denied: "Sign-in was refused by your identity provider.",
  status: "Your identity provider returned an unsuccessful SAML status.",
  signature: "The SAML response signature could not be verified with the configured X.509 certificate.",
  issuer: "The SAML response Issuer does not match the configured IdP Entity ID.",
  audience: "The SAML assertion Audience does not match this workspace's SP Entity ID.",
  expired: "The SAML assertion has expired or is not yet valid. Check clock synchronization.",
  xml: "The SAML response XML was malformed or unsupported.",
  not_configured: "SAML single sign-on is not configured or enabled for this workspace.",
  not_member: "Your company account signed in, but you have not been added to this workspace. Ask a workspace admin to invite you.",
  wrong_domain: "That account is not on an email domain allowed for SAML single sign-on.",
  no_email: "Your identity provider did not include an email address in NameID or attributes.",
  maintenance: "OnboardOps is under maintenance right now. Please try again shortly.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  session: "Sign in as the workspace owner first, then run the test.",
  exchange: "We could not finish SAML sign-in. Verify your IdP settings and try again.",
};

export class SamlError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || SAML_ERRORS[code] || SAML_ERRORS.exchange);
    this.name = "SamlError";
    this.code = code;
  }
}

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const samlAcsUrl = () => `${appUrl()}/api/auth/saml/callback`;
export const samlEntityId = (workspaceId: string) => `${appUrl()}/api/auth/saml/metadata?ws=${encodeURIComponent(workspaceId)}`;

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnesc(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, ent: string) => {
    if (ent === "amp") return "&";
    if (ent === "lt") return "<";
    if (ent === "gt") return ">";
    if (ent === "quot") return "\"";
    if (ent === "apos") return "'";
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const cp = parseInt(ent.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    }
    if (ent.startsWith("#")) {
      const cp = parseInt(ent.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    }
    return "";
  });
}

/** Generates valid SAML 2.0 Service Provider Metadata XML for Okta, Ping, OneLogin, ADFS. */
export function buildSpMetadataXml(workspaceId: string): string {
  const entityId = xmlEsc(samlEntityId(workspaceId));
  const acs = xmlEsc(samlAcsUrl());
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">`,
    `  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>`,
    `    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="1" isDefault="true"/>`,
    `  </md:SPSSODescriptor>`,
    `</md:EntityDescriptor>`,
  ].join("\n");
}

/** Validates and normalizes an X.509 certificate into canonical PEM using crypto.X509Certificate. */
export function normalizeCertPem(raw: string): string {
  const cleaned = raw
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  if (!cleaned || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    throw new Error("Invalid X.509 certificate PEM. Paste the certificate provided by your identity provider.");
  }
  const wrapped = cleaned.match(/.{1,64}/g)?.join("\n") ?? cleaned;
  const pem = `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
  try {
    // Rejects malformed DER / non-certificate PEM payloads cleanly.
    const cert = new X509Certificate(pem);
    if (!cert.publicKey) throw new Error("Missing public key");
    return pem;
  } catch {
    throw new Error("Invalid X.509 certificate PEM. Check that the full certificate was copied without truncation.");
  }
}

export function validateSsoUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid IdP SSO URL (https://...).");
  }
  const allowHttpLocal =
    process.env.NODE_ENV !== "production" &&
    u.protocol === "http:" &&
    (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !allowHttpLocal) {
    throw new Error("IdP SSO URL must use https://.");
  }
  return u.toString();
}

function parseTagAttributes(attrStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr))) {
    out[m[1]] = xmlUnesc(m[2] ?? m[3] ?? "");
  }
  return out;
}

/**
 * Extracts IdP Entity ID, SingleSignOnService URL (preferring HTTP-Redirect then HTTP-POST),
 * and primary/rollover X.509 signing certificates from SAML 2.0 IdP metadata XML.
 */
export function parseIdpMetadataXml(xml: string): {
  entityId: string;
  ssoUrl: string;
  certPem: string;
  extraCertPem?: string;
} {
  if (!xml || Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
    throw new Error("IdP metadata XML is empty or exceeds the 512 KB limit.");
  }
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error("Unsupported XML directives (DOCTYPE/ENTITY) are not allowed.");
  }
  const stripped = xml.replace(/<!--[\s\S]*?-->/g, "");

  // 1. EntityDescriptor entityID
  const edMatch = stripped.match(/<(?:[A-Za-z0-9_-]+:)?EntityDescriptor\b([^>]*)>/i);
  const edAttrs = edMatch ? parseTagAttributes(edMatch[1]) : {};
  const entityId = (edAttrs.entityID || edAttrs.entityId || "").trim();
  if (!entityId) {
    throw new Error("Could not find EntityDescriptor entityID in the metadata XML.");
  }

  // Scope SSO service and signing cert lookup to IDPSSODescriptor if present
  const idpMatch = stripped.match(/<(?:[A-Za-z0-9_-]+:)?IDPSSODescriptor\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?IDPSSODescriptor>/i);
  const scope = idpMatch ? idpMatch[1] : stripped;

  // 2. SingleSignOnService (prefer HTTP-Redirect, then HTTP-POST, then first valid URL)
  const ssoRe = /<(?:[A-Za-z0-9_-]+:)?SingleSignOnService\b([^>]*)\/?>/gi;
  let redirectUrl = "";
  let postUrl = "";
  let fallbackUrl = "";
  let sm: RegExpExecArray | null;
  while ((sm = ssoRe.exec(scope))) {
    const attrs = parseTagAttributes(sm[1]);
    const binding = attrs.Binding || "";
    const loc = (attrs.Location || "").trim();
    if (!loc) continue;
    if (/HTTP-Redirect/i.test(binding) && !redirectUrl) redirectUrl = loc;
    else if (/HTTP-POST/i.test(binding) && !postUrl) postUrl = loc;
    else if (!fallbackUrl) fallbackUrl = loc;
  }
  const chosenUrl = redirectUrl || postUrl || fallbackUrl;
  if (!chosenUrl) {
    throw new Error("Could not find a SingleSignOnService Location URL in the metadata XML.");
  }
  const ssoUrl = validateSsoUrl(chosenUrl);

  // 3. Signing X509Certificate elements (ignore encryption-only KeyDescriptors when signing certs exist)
  const certCandidates: string[] = [];
  const kdRe = /<(?:[A-Za-z0-9_-]+:)?KeyDescriptor\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?KeyDescriptor>/gi;
  let km: RegExpExecArray | null;
  while ((km = kdRe.exec(scope))) {
    const attrs = parseTagAttributes(km[1]);
    if (attrs.use && attrs.use.toLowerCase() === "encryption") continue;
    const certRe = /<(?:[A-Za-z0-9_-]+:)?X509Certificate\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?X509Certificate>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = certRe.exec(km[2]))) {
      certCandidates.push(cm[1]);
    }
  }
  if (!certCandidates.length) {
    const certRe = /<(?:[A-Za-z0-9_-]+:)?X509Certificate\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?X509Certificate>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = certRe.exec(scope))) {
      certCandidates.push(cm[1]);
    }
  }

  const certs: string[] = [];
  for (const raw of certCandidates) {
    try {
      const pem = normalizeCertPem(raw);
      if (!certs.includes(pem)) certs.push(pem);
    } catch {
      // Skip unreadable entries and keep checking remaining certificates
    }
  }
  if (!certs.length) {
    throw new Error("Could not find a valid X509Certificate in the metadata XML.");
  }

  return {
    entityId,
    ssoUrl,
    certPem: certs[0],
    ...(certs[1] ? { extraCertPem: certs[1] } : {}),
  };
}

/** Builds an HTTP-Redirect SAML 2.0 AuthnRequest URL (deflateRaw + base64 + URL-encoded). */
export function buildSamlAuthnRequestUrl(
  cfg: { ssoUrl: string; workspaceId: string },
  relayState: string,
): string {
  const id = `_${randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();
  const xml = [
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="${id}" Version="2.0" IssueInstant="${issueInstant}"`,
    ` Destination="${xmlEsc(cfg.ssoUrl)}"`,
    ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
    ` AssertionConsumerServiceURL="${xmlEsc(samlAcsUrl())}">`,
    `<saml:Issuer>${xmlEsc(samlEntityId(cfg.workspaceId))}</saml:Issuer>`,
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>`,
    `</samlp:AuthnRequest>`,
  ].join("");

  const deflated = deflateRawSync(Buffer.from(xml, "utf8"));
  const samlRequest = deflated.toString("base64");
  const u = new URL(cfg.ssoUrl);
  u.searchParams.set("SAMLRequest", samlRequest);
  if (relayState) u.searchParams.set("RelayState", relayState);
  return u.toString();
}

/* ---------------- Lightweight XML DOM + W3C Exclusive C14N 1.0 ---------------- */

type XmlAttr = { name: string; prefix: string; local: string; value: string };
type XmlText = { kind: "text"; value: string };
type XmlElem = {
  kind: "elem";
  tag: string;
  prefix: string;
  local: string;
  attrs: XmlAttr[];
  children: Array<XmlElem | XmlText>;
  parent: XmlElem | null;
  start: number;
  end: number;
};

function splitQName(name: string): { prefix: string; local: string } {
  const idx = name.indexOf(":");
  return idx === -1 ? { prefix: "", local: name } : { prefix: name.slice(0, idx), local: name.slice(idx + 1) };
}

function parseXmlDoc(rawXml: string): { xml: string; root: XmlElem } {
  if (!rawXml || Buffer.byteLength(rawXml, "utf8") > MAX_XML_BYTES) {
    throw new SamlError("xml", "SAML XML payload is empty or exceeds size limits.");
  }
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(rawXml)) {
    throw new SamlError("xml", "SAML XML cannot contain DOCTYPE or ENTITY declarations.");
  }
  const xml = rawXml.replace(/\r\n?/g, "\n");
  const len = xml.length;
  let i = 0;
  let root: XmlElem | null = null;
  const stack: XmlElem[] = [];
  let elemCount = 0;

  while (i < len) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      if (stack.length > 0 && i < len) {
        stack[stack.length - 1].children.push({ kind: "text", value: xmlUnesc(xml.slice(i)) });
      }
      break;
    }
    if (lt > i && stack.length > 0) {
      stack[stack.length - 1].children.push({ kind: "text", value: xmlUnesc(xml.slice(i, lt)) });
    }
    i = lt;

    // Processing instruction <?...?>
    if (xml.startsWith("<?", i)) {
      const end = xml.indexOf("?>", i + 2);
      if (end === -1) throw new SamlError("xml");
      i = end + 2;
      continue;
    }
    // Comment <!--...-->
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      if (end === -1) throw new SamlError("xml");
      i = end + 3;
      continue;
    }
    // CDATA <![CDATA[...]]>
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i + 9);
      if (end === -1) throw new SamlError("xml");
      if (stack.length > 0) {
        stack[stack.length - 1].children.push({ kind: "text", value: xml.slice(i + 9, end) });
      }
      i = end + 3;
      continue;
    }
    // Closing tag </...>
    if (xml.startsWith("</", i)) {
      const gt = xml.indexOf(">", i + 2);
      if (gt === -1) throw new SamlError("xml");
      const closeTag = xml.slice(i + 2, gt).trim();
      const top = stack.pop();
      if (!top || top.tag !== closeTag) throw new SamlError("xml");
      top.end = gt + 1;
      i = gt + 1;
      continue;
    }
    // Opening or self-closing tag
    const start = i;
    i++; // skip '<'
    let tagEnd = i;
    while (tagEnd < len && !/[\s/>]/.test(xml[tagEnd])) tagEnd++;
    const tag = xml.slice(i, tagEnd);
    if (!tag || !/^[A-Za-z_][\w.:-]*$/.test(tag)) throw new SamlError("xml");
    i = tagEnd;

    const attrs: XmlAttr[] = [];
    let selfClosing = false;
    while (i < len) {
      while (i < len && /\s/.test(xml[i])) i++;
      if (xml[i] === "/" && xml[i + 1] === ">") {
        selfClosing = true;
        i += 2;
        break;
      }
      if (xml[i] === ">") {
        i += 1;
        break;
      }
      const attrStart = i;
      while (i < len && !/[\s=/>]/.test(xml[i])) i++;
      const attrName = xml.slice(attrStart, i);
      if (!attrName) throw new SamlError("xml");
      while (i < len && /\s/.test(xml[i])) i++;
      if (xml[i] !== "=") throw new SamlError("xml");
      i++;
      while (i < len && /\s/.test(xml[i])) i++;
      const quote = xml[i];
      if (quote !== "\"" && quote !== "'") throw new SamlError("xml");
      i++;
      const valStart = i;
      const valEnd = xml.indexOf(quote, valStart);
      if (valEnd === -1) throw new SamlError("xml");
      const val = xmlUnesc(xml.slice(valStart, valEnd));
      i = valEnd + 1;
      const { prefix, local } = splitQName(attrName);
      attrs.push({ name: attrName, prefix, local, value: val });
    }

    elemCount++;
    if (elemCount > 5000 || stack.length > 64) throw new SamlError("xml");

    const { prefix, local } = splitQName(tag);
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const elem: XmlElem = { kind: "elem", tag, prefix, local, attrs, children: [], parent, start, end: i };
    if (parent) parent.children.push(elem);
    else if (!root) root = elem;
    else throw new SamlError("xml");

    if (!selfClosing) stack.push(elem);
  }

  if (!root || stack.length !== 0) throw new SamlError("xml");
  return { xml, root };
}

function getExactAttr(el: XmlElem, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function textContent(el: XmlElem): string {
  let out = "";
  for (const ch of el.children) {
    out += ch.kind === "text" ? ch.value : textContent(ch);
  }
  return out;
}

function findDirectChildren(el: XmlElem, localName: string): XmlElem[] {
  return el.children.filter((c): c is XmlElem => c.kind === "elem" && c.local === localName);
}

function findFirstDirect(el: XmlElem, localName: string): XmlElem | undefined {
  return el.children.find((c): c is XmlElem => c.kind === "elem" && c.local === localName);
}

function walkElems(el: XmlElem, visit: (node: XmlElem) => void) {
  visit(el);
  for (const ch of el.children) {
    if (ch.kind === "elem") walkElems(ch, visit);
  }
}

function c14nEscText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");
}

function c14nEscAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

function collectAncestorNamespaces(el: XmlElem): Map<string, string> {
  const chain: XmlElem[] = [];
  let cur = el.parent;
  while (cur) {
    chain.push(cur);
    cur = cur.parent;
  }
  chain.reverse();
  const ns = new Map<string, string>();
  for (const node of chain) {
    for (const a of node.attrs) {
      if (a.name === "xmlns") ns.set("", a.value);
      else if (a.prefix === "xmlns") ns.set(a.local, a.value);
    }
  }
  return ns;
}

/** W3C Canonical XML / Exclusive Canonical XML 1.0 serializer (without comments). */
function serializeC14n(
  target: XmlElem,
  opts: { exclusive: boolean; exclude?: XmlElem | null; inclusivePrefixes?: Set<string> },
): string {
  const ancestorNs = collectAncestorNamespaces(target);

  function render(el: XmlElem, inheritedScope: Map<string, string>, renderedNs: Map<string, string>): string {
    if (opts.exclude && el === opts.exclude) return "";

    const curScope = new Map(inheritedScope);
    const regularAttrs: XmlAttr[] = [];
    for (const a of el.attrs) {
      if (a.name === "xmlns") curScope.set("", a.value);
      else if (a.prefix === "xmlns") curScope.set(a.local, a.value);
      else regularAttrs.push(a);
    }

    const nsToEmit: Array<[string, string]> = [];
    if (opts.exclusive) {
      const utilized = new Set<string>([el.prefix]);
      for (const a of regularAttrs) {
        if (a.prefix && a.prefix !== "xml") utilized.add(a.prefix);
      }
      if (opts.inclusivePrefixes) {
        for (const p of opts.inclusivePrefixes) {
          if (curScope.has(p)) utilized.add(p);
        }
      }
      for (const p of utilized) {
        if (p === "xml") continue;
        const uri = curScope.get(p) ?? "";
        const prev = renderedNs.get(p) ?? "";
        if (p === "") {
          if (uri !== prev) nsToEmit.push(["", uri]);
        } else if (uri && uri !== prev) {
          nsToEmit.push([p, uri]);
        }
      }
    } else {
      for (const [p, uri] of curScope.entries()) {
        if (p === "xml") continue;
        const prev = renderedNs.get(p) ?? "";
        if (p === "") {
          if (uri !== prev) nsToEmit.push(["", uri]);
        } else if (uri && uri !== prev) {
          nsToEmit.push([p, uri]);
        }
      }
    }

    nsToEmit.sort((a, b) => {
      if (a[0] === "") return -1;
      if (b[0] === "") return 1;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });

    const nextRendered = new Map(renderedNs);
    for (const [p, uri] of nsToEmit) nextRendered.set(p, uri);

    regularAttrs.sort((a, b) => {
      const ua = a.prefix ? curScope.get(a.prefix) ?? "" : "";
      const ub = b.prefix ? curScope.get(b.prefix) ?? "" : "";
      if (ua !== ub) return ua < ub ? -1 : 1;
      return a.local < b.local ? -1 : a.local > b.local ? 1 : 0;
    });

    let out = `<${el.tag}`;
    for (const [p, uri] of nsToEmit) {
      out += p === "" ? ` xmlns="${c14nEscAttr(uri)}"` : ` xmlns:${p}="${c14nEscAttr(uri)}"`;
    }
    for (const a of regularAttrs) {
      out += ` ${a.name}="${c14nEscAttr(a.value)}"`;
    }
    out += ">";
    for (const ch of el.children) {
      out += ch.kind === "text" ? c14nEscText(ch.value) : render(ch, curScope, nextRendered);
    }
    out += `</${el.tag}>`;
    return out;
  }

  return render(target, ancestorNs, new Map());
}

function signatureAlgFromUri(uri: string): string | null {
  const u = uri.trim().toLowerCase();
  if (u.endsWith("#rsa-sha256")) return "RSA-SHA256";
  if (u.endsWith("#rsa-sha384")) return "RSA-SHA384";
  if (u.endsWith("#rsa-sha512")) return "RSA-SHA512";
  if (u.endsWith("#rsa-sha1")) return "RSA-SHA1";
  return null;
}

function digestAlgFromUri(uri: string): string | null {
  const u = uri.trim().toLowerCase();
  if (u.endsWith("#sha256")) return "sha256";
  if (u.endsWith("#sha384")) return "sha384";
  if (u.endsWith("#sha512")) return "sha512";
  if (u.endsWith("#sha1")) return "sha1";
  return null;
}

/** Peeks at the Issuer element in a base64 SAMLResponse (used only to select WorkspaceSaml for IdP-initiated login before cryptographic verification). */
export function peekSamlIssuer(samlResponseB64: string): string | null {
  try {
    const raw = Buffer.from(samlResponseB64, "base64").toString("utf8");
    const { root } = parseXmlDoc(raw);
    const directIssuer = findFirstDirect(root, "Issuer");
    if (directIssuer) {
      const v = textContent(directIssuer).trim();
      if (v) return v;
    }
    const assertion = findFirstDirect(root, "Assertion");
    if (assertion) {
      const aIssuer = findFirstDirect(assertion, "Issuer");
      const v = aIssuer ? textContent(aIssuer).trim() : "";
      if (v) return v;
    }
    return null;
  } catch {
    return null;
  }
}

export type SamlProfile = {
  issuer: string;
  subject: string;
  email: string;
  name: string;
  role?: string;
};

/**
 * Verifies a base64-encoded SAML 2.0 Response:
 * - StatusCode === Success
 * - Rejects duplicate IDs (XML Signature Wrapping defense)
 * - Cryptographically verifies XMLDSig SignatureValue & Reference DigestValue against cfg.certPem (with fallback to cfg.prevCertPem for zero-downtime cert rotation)
 * - Extracts claims ONLY from the cryptographically signed element
 * - Verifies Issuer, Conditions NotBefore/NotOnOrAfter (5-min clock skew), Audience (if present), and allowed email domains
 */
export function verifySamlResponse(
  samlResponseB64: string,
  cfg: {
    workspaceId: string;
    entityId: string;
    certPem: string;
    prevCertPem?: string | null;
    domains: string[];
    roleAttr?: string;
  },
): SamlProfile {
  if (!samlResponseB64 || samlResponseB64.length > MAX_XML_BYTES * 2) {
    throw new SamlError("xml");
  }
  const rawXml = Buffer.from(samlResponseB64, "base64").toString("utf8");
  const { xml, root } = parseXmlDoc(rawXml);

  if (root.local !== "Response") {
    throw new SamlError("xml", "Root SAML element must be Response.");
  }

  // 1. Check StatusCode === Success
  const statusEl = findFirstDirect(root, "Status");
  const statusCodeEl = statusEl ? findFirstDirect(statusEl, "StatusCode") : undefined;
  const statusVal = statusCodeEl ? getExactAttr(statusCodeEl, "Value") ?? "" : "";
  if (statusVal !== "urn:oasis:names:tc:SAML:2.0:status:Success") {
    throw new SamlError("status");
  }

  // 2. Index elements by ID and reject duplicate IDs (classic XSW attack vector)
  const idMap = new Map<string, XmlElem>();
  walkElems(root, (node) => {
    const id = getExactAttr(node, "ID") ?? getExactAttr(node, "Id") ?? getExactAttr(node, "id");
    if (id) {
      if (idMap.has(id)) {
        throw new SamlError("signature", "Duplicate XML ID detected in SAML response.");
      }
      idMap.set(id, node);
    }
  });

  // 3. Locate candidate Signatures (direct child of Response or direct child of an Assertion)
  const candidateSigs: XmlElem[] = [];
  for (const s of findDirectChildren(root, "Signature")) candidateSigs.push(s);
  for (const a of findDirectChildren(root, "Assertion")) {
    for (const s of findDirectChildren(a, "Signature")) candidateSigs.push(s);
  }
  if (!candidateSigs.length) {
    throw new SamlError("signature", "SAML response is not signed.");
  }

  // Normalize trusted certificates from DB (never trust embedded KeyInfo cert!)
  const trustedCerts = [normalizeCertPem(cfg.certPem)];
  if (cfg.prevCertPem?.trim()) {
    try {
      const prev = normalizeCertPem(cfg.prevCertPem);
      if (!trustedCerts.includes(prev)) trustedCerts.push(prev);
    } catch {
      // Ignore corrupt prevCertPem; primary cert still applies
    }
  }

  // 4. Verify signature(s) and bind to the exact signed Assertion/Response node
  let verifiedAssertion: XmlElem | null = null;
  let verifiedResponse = false;

  for (const sigEl of candidateSigs) {
    const signedInfo = findFirstDirect(sigEl, "SignedInfo");
    const sigValEl = findFirstDirect(sigEl, "SignatureValue");
    if (!signedInfo || !sigValEl) continue;

    const sigMethodEl = findFirstDirect(signedInfo, "SignatureMethod");
    const sigAlg = signatureAlgFromUri(sigMethodEl ? getExactAttr(sigMethodEl, "Algorithm") ?? "" : "");
    if (!sigAlg) continue;

    const sigBuf = Buffer.from(textContent(sigValEl).replace(/\s+/g, ""), "base64");
    if (!sigBuf.length) continue;

    const c14nMethodEl = findFirstDirect(signedInfo, "CanonicalizationMethod");
    const c14nAlg = (c14nMethodEl ? getExactAttr(c14nMethodEl, "Algorithm") ?? "" : "").toLowerCase();
    const siInclusivePrefixes = new Set<string>();
    const siIncEl = c14nMethodEl ? findFirstDirect(c14nMethodEl, "InclusiveNamespaces") : undefined;
    const siPrefixList = siIncEl ? getExactAttr(siIncEl, "PrefixList") ?? "" : "";
    for (const p of siPrefixList.split(/\s+/)) if (p) siInclusivePrefixes.add(p);

    const siCandidates = [
      serializeC14n(signedInfo, { exclusive: !c14nAlg.includes("2001/03/xml-c14n"), inclusivePrefixes: siInclusivePrefixes }),
      serializeC14n(signedInfo, { exclusive: true, inclusivePrefixes: siInclusivePrefixes }),
      serializeC14n(signedInfo, { exclusive: false }),
      xml.slice(signedInfo.start, signedInfo.end),
    ];

    let sigOk = false;
    outer: for (const certPem of trustedCerts) {
      for (const siBytes of siCandidates) {
        try {
          const verifier = createVerify(sigAlg);
          verifier.update(siBytes, "utf8");
          if (verifier.verify(certPem, sigBuf)) {
            sigOk = true;
            break outer;
          }
        } catch {
          // Try next canonicalization / cert
        }
      }
    }
    if (!sigOk) continue;

    // Verify every Reference inside SignedInfo
    const refs = findDirectChildren(signedInfo, "Reference");
    if (!refs.length) continue;

    let allRefsOk = true;
    let refTarget: XmlElem | null = null;

    for (const refEl of refs) {
      const uri = getExactAttr(refEl, "URI") ?? "";
      const targetNode = uri === "" ? root : uri.startsWith("#") ? idMap.get(uri.slice(1)) ?? null : null;
      if (!targetNode) {
        allRefsOk = false;
        break;
      }

      const digestMethodEl = findFirstDirect(refEl, "DigestMethod");
      const digestAlg = digestAlgFromUri(digestMethodEl ? getExactAttr(digestMethodEl, "Algorithm") ?? "" : "");
      const digestValEl = findFirstDirect(refEl, "DigestValue");
      if (!digestAlg || !digestValEl) {
        allRefsOk = false;
        break;
      }
      const expectedDigest = Buffer.from(textContent(digestValEl).replace(/\s+/g, ""), "base64");
      if (!expectedDigest.length) {
        allRefsOk = false;
        break;
      }

      const refInclusive = new Set<string>();
      const transformsEl = findFirstDirect(refEl, "Transforms");
      let preferInclusive = false;
      if (transformsEl) {
        for (const tr of findDirectChildren(transformsEl, "Transform")) {
          const alg = (getExactAttr(tr, "Algorithm") ?? "").toLowerCase();
          if (alg.includes("2001/03/xml-c14n")) preferInclusive = true;
          const inc = findFirstDirect(tr, "InclusiveNamespaces");
          const pl = inc ? getExactAttr(inc, "PrefixList") ?? "" : "";
          for (const p of pl.split(/\s+/)) if (p) refInclusive.add(p);
        }
      }

      // Remove enveloped Signature node before digesting
      const rawWithoutSig =
        sigEl.start >= targetNode.start && sigEl.end <= targetNode.end
          ? xml.slice(targetNode.start, sigEl.start) + xml.slice(sigEl.end, targetNode.end)
          : xml.slice(targetNode.start, targetNode.end);

      const targetCandidates = [
        serializeC14n(targetNode, { exclusive: !preferInclusive, exclude: sigEl, inclusivePrefixes: refInclusive }),
        serializeC14n(targetNode, { exclusive: true, exclude: sigEl, inclusivePrefixes: refInclusive }),
        serializeC14n(targetNode, { exclusive: false, exclude: sigEl }),
        rawWithoutSig,
      ];

      let digestMatch = false;
      for (const bytes of targetCandidates) {
        const computed = createHash(digestAlg).update(bytes, "utf8").digest();
        if (computed.length === expectedDigest.length && timingSafeEqual(computed, expectedDigest)) {
          digestMatch = true;
          break;
        }
      }
      if (!digestMatch) {
        allRefsOk = false;
        break;
      }
      refTarget = targetNode;
    }

    if (!allRefsOk || !refTarget) continue;

    if (refTarget.local === "Assertion" && refTarget.parent === root) {
      verifiedAssertion = refTarget;
      break;
    }
    if (refTarget === root) {
      verifiedResponse = true;
    }
  }

  if (!verifiedAssertion && verifiedResponse) {
    const assertions = findDirectChildren(root, "Assertion");
    if (assertions.length !== 1) {
      throw new SamlError("signature", "Signed SAML response must contain exactly one Assertion.");
    }
    verifiedAssertion = assertions[0];
  }

  if (!verifiedAssertion) {
    throw new SamlError("signature");
  }

  // 5. Verify Issuer strictly from signed content (Assertion Issuer, or Response Issuer only when Response itself was signed)
  const assertionIssuerEl = findFirstDirect(verifiedAssertion, "Issuer");
  const responseIssuerEl = findFirstDirect(root, "Issuer");
  const issuerEl = assertionIssuerEl ?? (verifiedResponse ? responseIssuerEl : undefined);
  const issuer = issuerEl ? textContent(issuerEl).trim() : "";
  if (!issuer || issuer !== cfg.entityId.trim()) {
    throw new SamlError("issuer");
  }
  if (verifiedResponse && assertionIssuerEl && responseIssuerEl) {
    const rIss = textContent(responseIssuerEl).trim();
    if (rIss && rIss !== cfg.entityId.trim()) {
      throw new SamlError("issuer");
    }
  }

  // 6. Verify Conditions (NotBefore, NotOnOrAfter with 5-minute skew, Audience if present)
  const now = Date.now();
  const conditions = findFirstDirect(verifiedAssertion, "Conditions");
  if (conditions) {
    const nb = getExactAttr(conditions, "NotBefore");
    if (nb) {
      const t = Date.parse(nb);
      if (Number.isNaN(t) || now + CLOCK_SKEW_MS < t) throw new SamlError("expired");
    }
    const noa = getExactAttr(conditions, "NotOnOrAfter");
    if (noa) {
      const t = Date.parse(noa);
      if (Number.isNaN(t) || now - CLOCK_SKEW_MS >= t) throw new SamlError("expired");
    }

    const audiences: string[] = [];
    for (const ar of findDirectChildren(conditions, "AudienceRestriction")) {
      for (const aud of findDirectChildren(ar, "Audience")) {
        const val = textContent(aud).trim();
        if (val) audiences.push(val);
      }
    }
    if (audiences.length > 0 && !audiences.includes(samlEntityId(cfg.workspaceId))) {
      throw new SamlError("audience");
    }
  }

  // Also check SubjectConfirmationData NotOnOrAfter if present
  const subjectEl = findFirstDirect(verifiedAssertion, "Subject");
  if (subjectEl) {
    for (const sc of findDirectChildren(subjectEl, "SubjectConfirmation")) {
      const scd = findFirstDirect(sc, "SubjectConfirmationData");
      const noa = scd ? getExactAttr(scd, "NotOnOrAfter") : undefined;
      if (noa) {
        const t = Date.parse(noa);
        if (Number.isNaN(t) || now - CLOCK_SKEW_MS >= t) throw new SamlError("expired");
      }
    }
  }

  // 7. Extract NameID & Attributes from the verified Assertion
  const nameIdEl = subjectEl ? findFirstDirect(subjectEl, "NameID") : undefined;
  const nameId = nameIdEl ? textContent(nameIdEl).trim() : "";

  const attrMap = new Map<string, string[]>();
  for (const stmt of findDirectChildren(verifiedAssertion, "AttributeStatement")) {
    for (const attr of findDirectChildren(stmt, "Attribute")) {
      const vals = findDirectChildren(attr, "AttributeValue")
        .map((v) => textContent(v).trim())
        .filter(Boolean);
      if (!vals.length) continue;
      const n = getExactAttr(attr, "Name")?.trim().toLowerCase();
      const fn = getExactAttr(attr, "FriendlyName")?.trim().toLowerCase();
      if (n) attrMap.set(n, [...(attrMap.get(n) ?? []), ...vals]);
      if (fn && fn !== n) attrMap.set(fn, [...(attrMap.get(fn) ?? []), ...vals]);
    }
  }

  const firstAttr = (...keys: string[]) => {
    for (const k of keys) {
      const v = attrMap.get(k.toLowerCase())?.[0];
      if (v) return v;
    }
    return "";
  };

  const emailRaw =
    firstAttr(
      "email",
      "mail",
      "emailaddress",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "urn:oid:0.9.2342.19200300.100.1.3",
      "user.email",
    ) || (nameId.includes("@") ? nameId : "");

  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new SamlError("no_email");
  }

  // 8. Enforce allowed domains
  const dom = emailDomain(email);
  const allowedDomains = cfg.domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (!allowedDomains.length || !allowedDomains.includes(dom)) {
    throw new SamlError("wrong_domain");
  }

  // Display name extraction
  const displayName = firstAttr(
    "displayname",
    "name",
    "cn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.microsoft.com/identity/claims/displayname",
  );
  const firstName = firstAttr(
    "firstname",
    "givenname",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "urn:oid:2.5.4.42",
  );
  const lastName = firstAttr(
    "lastname",
    "surname",
    "sn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "urn:oid:2.5.4.4",
  );
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name = displayName || combinedName || email.split("@")[0];

  const roleKey = (cfg.roleAttr || "role").trim().toLowerCase();
  const role =
    firstAttr(
      roleKey,
      ...(roleKey === "role" ? ["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] : []),
    ) || undefined;

  return {
    issuer,
    subject: nameId || email,
    email,
    name,
    ...(role ? { role } : {}),
  };
}

/* ---------------- Domain lookup & enforcement ---------------- */

/** Returns the enabled WorkspaceSaml configuration for an email's domain, if any. */
export async function samlForEmail(email: string) {
  const d = emailDomain(email);
  if (!d) return null;
  try {
    return await prisma.workspaceSaml.findFirst({
      where: { enabled: true, domains: { has: d } },
    });
  } catch {
    return null;
  }
}

/** True when this person must use SAML SSO and cannot sign in with a password (owners are exempt). */
export async function samlRequiredFor(email: string): Promise<{ workspaceId: string } | null> {
  const cfg = await samlForEmail(email);
  if (!cfg || !cfg.enforce) return null;
  const user = await findUserByAnyEmail(email);
  if (!user) return null;
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: cfg.workspaceId, userId: user.id } },
  });
  return m && m.role !== "OWNER" ? { workspaceId: cfg.workspaceId } : null;
}

/* ---------------- Signed SAML state cookie ---------------- */

export type SamlFlow = {
  wsId: string;
  relayState: string;
  test?: boolean;
  uid?: string;
  email?: string;
};

const samlKey = () =>
  new TextEncoder().encode(
    createHash("sha256")
      .update(`saml-state:${process.env.SESSION_SECRET || "dev-only-secret-change-me-please-32chars"}`)
      .digest("hex"),
  );

export const newSamlFlow = (wsId: string, extra: Partial<SamlFlow> = {}): SamlFlow => ({
  wsId,
  relayState: randomBytes(24).toString("base64url"),
  ...extra,
});

export const signSamlFlow = (f: SamlFlow) =>
  new SignJWT({ purpose: "saml", ...f })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SAML_TTL_SECONDS}s`)
    .sign(samlKey());

export async function verifySamlFlow(token: string | undefined | null): Promise<SamlFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, samlKey());
    if (payload.purpose !== "saml" || typeof payload.wsId !== "string" || typeof payload.relayState !== "string") {
      return null;
    }
    const { purpose: _p, iat: _i, exp: _e, ...rest } = payload as Record<string, unknown>;
    return rest as unknown as SamlFlow;
  } catch {
    return null;
  }
}

export const samlStateMatches = (a: string | null | undefined, b: string) =>
  !!a && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
