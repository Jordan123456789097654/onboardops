export const MAX_LOGO_BYTES = 512 * 1024; // 512 KB

export type LogoMime = "image/png" | "image/jpeg" | "image/webp";
export type LogoExt = "png" | "jpg" | "webp";

export type ParsedLogo = {
  data: Buffer;
  mime: LogoMime;
  ext: LogoExt;
};

const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/;
const BASE64_BODY_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Returns the file extension for a supported logo MIME type. */
export function logoExtension(mime?: string | null): LogoExt {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

/** Public URL for a workspace's uploaded logo (cache-busted by logoUpdatedAt), or null if none is set. */
export function workspaceLogoUrl(ws: { id: string; logoUpdatedAt?: Date | string | null }): string | null {
  if (!ws.logoUpdatedAt) return null;
  const ts = ws.logoUpdatedAt instanceof Date ? ws.logoUpdatedAt.getTime() : new Date(ws.logoUpdatedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return `/api/workspace-logo/${ws.id}?v=${ts}`;
}

function detectMagicMime(buf: Buffer): LogoMime | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validates and decodes a `data:image/(png|jpeg|webp);base64,...` logo payload.
 * Enforces a 1..512 KB byte limit and checks actual magic bytes so spoofed MIME types are rejected.
 */
export function parseLogoDataUrl(dataUrl: string): ParsedLogo {
  if (typeof dataUrl !== "string" || !dataUrl.trim()) {
    throw new Error("Upload a company logo (PNG, JPG, or WebP).");
  }
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Logo must be a PNG, JPG, or WebP image.");
  }

  const declaredSubtype = match[1] as "png" | "jpeg" | "webp";
  const declaredMime: LogoMime = `image/${declaredSubtype}`;
  const b64 = match[2].replace(/\s+/g, "");

  if (!b64 || b64.length % 4 === 1 || !BASE64_BODY_RE.test(b64)) {
    throw new Error("Could not read that logo image. Try exporting it as PNG, JPG, or WebP.");
  }

  // Fast upper-bound check before allocating the decoded buffer
  if (Math.ceil((b64.length * 3) / 4) > MAX_LOGO_BYTES + 4) {
    throw new Error("Logo is too large. Please upload an image under 512 KB.");
  }

  const data = Buffer.from(b64, "base64");
  if (data.length < 1) {
    throw new Error("The uploaded logo file is empty.");
  }
  if (data.length > MAX_LOGO_BYTES) {
    throw new Error("Logo is too large. Please upload an image under 512 KB.");
  }

  const actualMime = detectMagicMime(data);
  if (!actualMime || actualMime !== declaredMime) {
    throw new Error("The uploaded file is not a valid PNG, JPG, or WebP image.");
  }

  return {
    data,
    mime: actualMime,
    ext: logoExtension(actualMime),
  };
}
