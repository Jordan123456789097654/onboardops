import { randomInt } from "crypto";
import QRCode from "qrcode";
import { LineCapStyle, PDFDocument, degrees, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "./prisma";
import { getActiveMembership } from "./auth";
import { mfaBlocked } from "./rbac";

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");

export const verifyUrl = (code: string) => `${appUrl()}/verify?code=${encodeURIComponent(code)}`;

/** New codes are 8 digits, so they can't be guessed. Older 5-digit codes keep working. */
export function newCertCode() {
  return `CERT-${randomInt(10_000_000, 99_999_999)}`;
}

/** A passed course always has a code. Fills one in for any pass that was recorded without it. */
export async function ensureCertificateCode(enrollmentId: string): Promise<string | null> {
  const e = await prisma.courseEnrollment.findUnique({ where: { id: enrollmentId }, select: { certificateCode: true, status: true } });
  if (!e || e.status !== "PASSED") return null;
  if (e.certificateCode) return e.certificateCode;
  for (let i = 0; i < 6; i++) {
    const code = newCertCode();
    try {
      await prisma.courseEnrollment.update({ where: { id: enrollmentId }, data: { certificateCode: code } });
      return code;
    } catch {
      // Unique clash: try another code.
    }
  }
  return null;
}

export type CertificateData = {
  id: string;
  code: string;
  workspaceName: string;
  employeeName: string;
  staffCode: string;
  courseTitle: string;
  score: number;
  passingScore: number;
  issued: Date;
  expires: Date | null;
  verifyUrl: string;
};

export type CertificateLookup = { kind: "login" | "mfa" | "missing" } | { kind: "ok"; data: CertificateData };

/** Same access rules for the printable page and the PDF: staff in the workspace, or the employee themself. */
export async function loadCertificate(id: string): Promise<CertificateLookup> {
  const m = await getActiveMembership();
  if (!m) return { kind: "login" };
  if (mfaBlocked(m)) return { kind: "mfa" };
  const e = await prisma.courseEnrollment.findFirst({ where: { id, workspaceId: m.workspaceId, status: "PASSED" }, include: { course: true, employee: true } });
  if (!e) return { kind: "missing" };
  if (m.role === "EMPLOYEE" && m.profile?.id !== e.employeeId) return { kind: "missing" };
  const code = e.certificateCode ?? (await ensureCertificateCode(e.id));
  if (!code) return { kind: "missing" };
  return {
    kind: "ok",
    data: {
      id: e.id,
      code,
      workspaceName: m.workspace.name,
      employeeName: e.employee.fullName,
      staffCode: e.employee.staffCode,
      courseTitle: e.course.title,
      score: e.bestScore ?? 0,
      passingScore: e.course.passingScore,
      issued: e.completedAt ?? new Date(),
      expires: e.expiresAt,
      verifyUrl: verifyUrl(code),
    },
  };
}

export const qrDataUrl = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: "#14213d", light: "#ffffff" } });

/* ---------------- PDF ---------------- */

const NAVY = rgb(0.078, 0.129, 0.239);
const GOLD = rgb(0.698, 0.553, 0.239);
const GOLD_LIGHT = rgb(0.9, 0.82, 0.6);
const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.38, 0.38, 0.42);
const WHITE = rgb(1, 1, 1);

/** Standard PDF fonts only cover Latin text. Anything else becomes "?" instead of crashing the download. */
function safe(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return Array.from(text.normalize("NFC")).map((c) => (set.has(c.codePointAt(0)!) ? c : c === "\n" ? " " : "?")).join("");
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function center(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const t = safe(font, text);
  page.drawText(t, { x: (page.getWidth() - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
}

/** Letter-spaced capitals for headings. */
function spaced(page: PDFPage, text: string, y: number, font: PDFFont, size: number, spacing: number, color: typeof NAVY, cx = page.getWidth() / 2) {
  const t = safe(font, text);
  const chars = Array.from(t);
  const widths = chars.map((c) => font.widthOfTextAtSize(c, size));
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    page.drawText(c, { x, y, size, font, color });
    x += widths[i] + spacing;
  });
}

function wrap(font: PDFFont, text: string, size: number, max: number): string[] {
  const words = safe(font, text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function seal(page: PDFPage, cx: number, cy: number, r: number) {
  // Ribbon tails first, so the seal sits on top of them.
  page.drawSvgPath("M-30,0 L-4,0 L0,62 L-17,48 L-34,62 Z", { x: cx - 4, y: cy - 8, color: NAVY });
  page.drawSvgPath("M4,0 L30,0 L34,62 L17,48 L0,62 Z", { x: cx + 4, y: cy - 8, color: NAVY });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    page.drawCircle({ x: cx + Math.cos(a) * (r - 4), y: cy + Math.sin(a) * (r - 4), size: 5.2, color: GOLD });
  }
  page.drawCircle({ x: cx, y: cy, size: r - 4, color: GOLD });
  page.drawCircle({ x: cx, y: cy, size: r - 9, color: GOLD_LIGHT });
  page.drawCircle({ x: cx, y: cy, size: r - 11, color: GOLD });
  page.drawCircle({ x: cx, y: cy, size: r - 16, color: NAVY });
  page.drawCircle({ x: cx, y: cy, size: r - 19, borderColor: GOLD_LIGHT, borderWidth: 0.8 });
  page.drawSvgPath("M-13,1 L-4,10 L14,-9", { x: cx, y: cy, borderColor: WHITE, borderWidth: 4.5, borderLineCap: LineCapStyle.Round });
}

function corner(page: PDFPage, x: number, y: number, dx: 1 | -1, dy: 1 | -1) {
  const len = 34;
  page.drawLine({ start: { x, y }, end: { x: x + dx * len, y }, thickness: 1.6, color: GOLD });
  page.drawLine({ start: { x, y }, end: { x, y: y + dy * len }, thickness: 1.6, color: GOLD });
  page.drawRectangle({ x: x + dx * 7, y: y + dy * 7 - 3.5, width: 5, height: 5, color: GOLD, rotate: degrees(45) });
}

/** A printable, letter-size landscape certificate with a seal, signature line and a QR code that opens the verify page. */
export async function buildCertificatePdf(c: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of Completion: ${c.courseTitle}`);
  pdf.setAuthor(c.workspaceName);
  pdf.setSubject(`Certificate ${c.code}`);
  pdf.setProducer("OnboardOps");
  const page = pdf.addPage([792, 612]);
  const W = 792;
  const H = 612;
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifI = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const serifBI = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);

  // Frame: heavy navy outer line, fine gold inner line, gold corner marks.
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: NAVY, borderWidth: 3.5 });
  page.drawRectangle({ x: 31, y: 31, width: W - 62, height: H - 62, borderColor: GOLD, borderWidth: 1 });
  page.drawRectangle({ x: 35, y: 35, width: W - 70, height: H - 70, borderColor: NAVY, borderWidth: 0.5 });
  corner(page, 46, 46, 1, 1);
  corner(page, W - 46, 46, -1, 1);
  corner(page, 46, H - 46, 1, -1);
  corner(page, W - 46, H - 46, -1, -1);

  spaced(page, c.workspaceName.toUpperCase().slice(0, 60), 538, sansB, 11, 2.6, NAVY);
  page.drawLine({ start: { x: W / 2 - 110, y: 522 }, end: { x: W / 2 - 10, y: 522 }, thickness: 0.8, color: GOLD });
  page.drawLine({ start: { x: W / 2 + 10, y: 522 }, end: { x: W / 2 + 110, y: 522 }, thickness: 0.8, color: GOLD });
  page.drawRectangle({ x: W / 2, y: 518, width: 5, height: 5, color: GOLD, rotate: degrees(45) });

  spaced(page, "CERTIFICATE", 466, serifB, 46, 5, NAVY);
  spaced(page, "OF COMPLETION", 440, sansB, 12.5, 5, GOLD);

  center(page, "This certifies that", 402, serifI, 15, GRAY);
  const nameSize = c.employeeName.length > 34 ? 28 : 38;
  center(page, c.employeeName, 360, serifBI, nameSize, INK);
  const nameW = serifBI.widthOfTextAtSize(safe(serifBI, c.employeeName), nameSize);
  const ul = Math.max(nameW + 70, 300);
  page.drawLine({ start: { x: (W - ul) / 2, y: 350 }, end: { x: (W + ul) / 2, y: 350 }, thickness: 1, color: GOLD });
  center(page, c.staffCode, 335, mono, 9.5, GRAY);

  center(page, "has successfully completed the training course", 308, serifI, 14.5, GRAY);
  let size = 26;
  let lines = wrap(serifB, c.courseTitle, size, 620);
  while (lines.length > 1 && size > 18) {
    size -= 2;
    lines = wrap(serifB, c.courseTitle, size, 620);
  }
  lines = lines.slice(0, 2);
  lines.forEach((l, i) => center(page, l, 276 - i * (size + 4), serifB, size, NAVY));
  const afterTitle = 276 - (lines.length - 1) * (size + 4);
  center(page, `with a score of ${c.score}%  ·  passing score ${c.passingScore}%`, afterTitle - 28, sans, 11, GRAY);

  // Signature row and seal.
  const rowY = 146;
  page.drawLine({ start: { x: 96, y: rowY }, end: { x: 296, y: rowY }, thickness: 0.8, color: INK });
  page.drawLine({ start: { x: 496, y: rowY }, end: { x: 696, y: rowY }, thickness: 0.8, color: INK });
  page.drawText(fmt(c.issued), { x: 196 - serif.widthOfTextAtSize(fmt(c.issued), 13) / 2, y: rowY + 6, size: 13, font: serif, color: INK });
  page.drawText("Date issued", { x: 196 - sans.widthOfTextAtSize("Date issued", 9) / 2, y: rowY - 14, size: 9, font: sans, color: GRAY });
  const sig = "Authorized signature";
  page.drawText(sig, { x: 596 - sans.widthOfTextAtSize(sig, 9) / 2, y: rowY - 14, size: 9, font: sans, color: GRAY });
  const org = safe(sans, c.workspaceName).slice(0, 48);
  page.drawText(org, { x: 596 - sans.widthOfTextAtSize(org, 8.5) / 2, y: rowY - 26, size: 8.5, font: sans, color: GRAY });
  seal(page, W / 2, rowY + 6, 44);

  // Footer: QR, certificate number and expiry.
  const qr = await pdf.embedPng(await QRCode.toBuffer(c.verifyUrl, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#14213d", light: "#ffffff" } }));
  page.drawImage(qr, { x: 62, y: 56, width: 58, height: 58 });
  page.drawText("CERTIFICATE NUMBER", { x: 130, y: 98, size: 7.5, font: sansB, color: GRAY });
  page.drawText(c.code, { x: 130, y: 82, size: 15, font: mono, color: NAVY });
  page.drawText("Scan or visit onboardops.org/verify to confirm it is real", { x: 130, y: 66, size: 7.5, font: sans, color: GRAY });
  if (c.expires) {
    const label = `${c.expires < new Date() ? "EXPIRED" : "VALID UNTIL"}  ${fmt(c.expires).toUpperCase()}`;
    page.drawText(label, { x: W - 62 - sansB.widthOfTextAtSize(label, 8.5), y: 88, size: 8.5, font: sansB, color: NAVY });
  }
  const foot = "Issued through OnboardOps. This confirms a training course was passed. Check with the employer for current qualification.";
  center(page, foot, 41, sans, 7, GRAY);

  return pdf.save();
}
