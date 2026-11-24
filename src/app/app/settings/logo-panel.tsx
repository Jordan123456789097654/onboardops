"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { saveWorkspaceLogoAction } from "@/actions/logo";
import { useAction, useToast } from "@/components/ui";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_DIMENSION = 512;
const TARGET_MAX_BYTES = 350 * 1024;
const HARD_MAX_BYTES = 512 * 1024;

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return Infinity;
  const b64 = dataUrl.slice(comma + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image. Try a different PNG, JPG, or WebP file."));
    };
    img.src = objectUrl;
  });
}

async function resizeLogoFile(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Please choose a PNG, JPG, or WebP image.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image file is too large to process (max 20 MB source file).");
  }

  const img = await loadImage(file);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) {
    throw new Error("Could not read image dimensions.");
  }

  const renderCanvas = (maxDim: number, fillWhite: boolean) => {
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser canvas is unavailable.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (fillWhite) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  };

  for (const maxDim of [MAX_DIMENSION, 384, 256]) {
    const canvas = renderCanvas(maxDim, file.type === "image/jpeg");

    if (file.type === "image/jpeg") {
      for (const quality of [0.9, 0.82, 0.72]) {
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.startsWith("data:image/jpeg;base64,") && dataUrlByteLength(url) <= TARGET_MAX_BYTES) {
          return url;
        }
      }
      continue;
    }

    // Preserve crispness & transparency for PNG/WebP first
    const pngUrl = canvas.toDataURL("image/png");
    if (pngUrl.startsWith("data:image/png;base64,") && dataUrlByteLength(pngUrl) <= TARGET_MAX_BYTES) {
      return pngUrl;
    }

    // Fall back to WebP (preserves transparency while staying compact)
    for (const quality of [0.9, 0.82, 0.72]) {
      const webpUrl = canvas.toDataURL("image/webp", quality);
      if (webpUrl.startsWith("data:image/webp;base64,") && dataUrlByteLength(webpUrl) <= TARGET_MAX_BYTES) {
        return webpUrl;
      }
    }

    // Final fallback on smaller canvas: JPEG with white matte if browser lacks WebP encoding
    if (maxDim === 256) {
      const matte = renderCanvas(maxDim, true);
      const jpgUrl = matte.toDataURL("image/jpeg", 0.85);
      if (jpgUrl.startsWith("data:image/jpeg;base64,") && dataUrlByteLength(jpgUrl) <= HARD_MAX_BYTES) {
        return jpgUrl;
      }
    }
  }

  throw new Error("Could not compress logo under 350 KB. Try a simpler PNG, JPG, or WebP image.");
}

export type LogoPanelProps = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  onUploaded?: (logoUrl: string) => void;
};

export function LogoPanel({ workspaceId, workspaceName, logoUrl, onUploaded }: LogoPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(logoUrl);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setCurrentUrl(logoUrl);
  }, [logoUrl]);

  const initials =
    workspaceName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "WS";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      const dataUrl = await resizeLogoFile(file);
      exec(() => saveWorkspaceLogoAction(dataUrl), {
        success: "Workspace logo updated",
        onOk: (d) => {
          setCurrentUrl(d.logoUrl);
          onUploaded?.(d.logoUrl);
          router.refresh();
        },
      });
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not process that logo image.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const busy = pending || processing;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {currentUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={currentUrl}
          alt={`${workspaceName} logo`}
          className="h-16 w-16 shrink-0 rounded-lg border border-line bg-surface object-contain p-1"
        />
      ) : (
        <span
          aria-label={`${workspaceName} initials`}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-muted text-lg font-semibold text-soft"
        >
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? "Uploading…" : currentUrl ? "Replace logo" : "Upload logo"}
          </button>
          {currentUrl && (
            <a
              href={`/api/workspace-logo/${workspaceId}?download=1`}
              download
              className="btn"
            >
              <Download className="h-3.5 w-3.5" />
              Download logo
            </a>
          )}
        </div>
        <p className="text-xs text-soft">
          PNG, JPG, or WebP. Resized automatically to fit 512×512 (under 512 KB). Shown in the app sidebar and on your staff sign-in page.
        </p>
      </div>
    </div>
  );
}
