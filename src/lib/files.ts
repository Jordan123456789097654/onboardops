import { prisma } from "./prisma";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are limited to ~4.5 MB
const allowed: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt"],
};
export const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt";

/** Validates and stores an uploaded file in the database. Throws a readable Error on rejection. */
export async function storeUpload(workspaceId: string, file: File, uploadedByName: string) {
  if (!file || file.size === 0) throw new Error("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Files can be at most 4 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = Object.keys(allowed).find((m) => allowed[m].includes(ext));
  if (!mime) throw new Error("Allowed file types: PDF, PNG, JPG, WEBP, DOCX and TXT.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (mime === "application/pdf" && buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("That file is not a valid PDF.");
  if (mime === "image/png" && buf.subarray(1, 4).toString("latin1") !== "PNG") throw new Error("That file is not a valid PNG.");
  if (mime === "image/jpeg" && !(buf[0] === 0xff && buf[1] === 0xd8)) throw new Error("That file is not a valid JPEG.");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return prisma.storedFile.create({ data: { workspaceId, name: safeName, mime, size: buf.length, data: buf, uploadedByName } });
}
