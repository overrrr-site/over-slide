const DOCUMENT_TYPE_MAP: Record<string, string> = {
  pdf: "pdf",
  ppt: "ppt",
  pptx: "pptx",
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  csv: "csv",
  txt: "text",
  md: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  heic: "image",
  heif: "image",
};

export function getLowercaseExtension(fileName: string): string {
  return fileName.trim().split(".").pop()?.toLowerCase() || "";
}

export function inferDocumentType(fileName: string): string {
  const ext = getLowercaseExtension(fileName);
  return DOCUMENT_TYPE_MAP[ext] || "other";
}

export function buildTimestampStoragePath(
  prefix: string,
  fileName: string
): string {
  const ext = getLowercaseExtension(fileName);
  const suffix = ext ? `.${ext}` : "";
  return `${prefix}/${Date.now()}${suffix}`;
}
