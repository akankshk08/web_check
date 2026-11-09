/** Upload rules shared by the browser (early feedback) and the server (enforcement). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "application/json": ["json"],
  "video/mp4": ["mp4"],
};

export const ACCEPT_ATTRIBUTE = Object.values(ALLOWED_MIME_TYPES)
  .flat()
  .map((e) => `.${e}`)
  .join(",");

export function validateFileMeta(fileName: string, mimeType: string, sizeBytes: number): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowed = ALLOWED_MIME_TYPES[mimeType];
  if (!allowed || !allowed.includes(ext)) return "This file type isn't allowed.";
  if (sizeBytes <= 0) return "The file is empty.";
  if (sizeBytes > MAX_FILE_BYTES) return `Files must be ${MAX_FILE_BYTES / 1024 / 1024} MB or smaller.`;
  return null;
}

/** Storage-safe file name (keeps extension). */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(-120);
  return cleaned || "file";
}
