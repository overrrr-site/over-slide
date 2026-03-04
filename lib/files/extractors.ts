/**
 * Text extraction from uploaded files.
 * Supports: PDF, Office docs, spreadsheets, text files, image files
 */

function ensurePdfJsNodePolyfills(): void {
  const g = globalThis as Record<string, unknown>;

  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixPolyfill {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor() {}

      multiplySelf(): this {
        return this;
      }

      preMultiplySelf(): this {
        return this;
      }

      translateSelf(): this {
        return this;
      }

      scaleSelf(): this {
        return this;
      }

      rotateSelf(): this {
        return this;
      }

      invertSelf(): this {
        return this;
      }

      clone(): DOMMatrixPolyfill {
        return new DOMMatrixPolyfill();
      }

      transformPoint(point?: { x?: number; y?: number; z?: number; w?: number }) {
        return {
          x: point?.x ?? 0,
          y: point?.y ?? 0,
          z: point?.z ?? 0,
          w: point?.w ?? 1,
        };
      }

      static fromMatrix(): DOMMatrixPolyfill {
        return new DOMMatrixPolyfill();
      }
    }

    g.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof g.Path2D === "undefined") {
    class Path2DPolyfill {
      addPath(): void {}
    }

    g.Path2D = Path2DPolyfill;
  }

  if (typeof g.ImageData === "undefined") {
    class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(dataOrWidth: Uint8ClampedArray | number, width?: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = typeof width === "number" ? width : 0;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
          return;
        }

        this.data = dataOrWidth;
        this.width = typeof width === "number" ? width : 0;
        this.height = typeof height === "number" ? height : 0;
      }
    }

    g.ImageData = ImageDataPolyfill;
  }
}

function sanitizeExtractedText(text: string): string {
  if (!text) return "";

  // Replace lone surrogates with the replacement character when supported.
  if (typeof text.toWellFormed === "function") {
    text = text.toWellFormed();
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  let rawText = "";

  switch (ext) {
    case "pdf":
      rawText = await extractPdf(buffer);
      break;
    case "ppt":
    case "pptx":
    case "doc":
    case "docx":
      rawText = await extractOffice(buffer);
      break;
    case "xls":
    case "xlsx":
      rawText = await extractExcel(buffer);
      break;
    case "csv":
    case "txt":
    case "md":
      rawText = buffer.toString("utf-8");
      break;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "bmp":
    case "heic":
    case "heif":
      rawText = "";
      break;
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }

  return sanitizeExtractedText(rawText);
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    return await extractPdfWithWorker(buffer);
  } catch (workerError) {
    console.warn("[extractPdf] Worker extraction failed. Falling back to in-process pdfjs.", {
      error: workerError instanceof Error ? workerError.message : String(workerError),
    });
  }

  try {
    return await extractPdfInProcess(buffer);
  } catch (processError) {
    console.warn("[extractPdf] In-process pdfjs extraction failed. Falling back to pdf-parse.", {
      error: processError instanceof Error ? processError.message : String(processError),
    });
  }

  return extractPdfWithPdfParse(buffer);
}

async function extractPdfWithWorker(buffer: Buffer): Promise<string> {
  // PDF抽出を別プロセスで実行（メインサーバーのメモリを保護）
  const { execFileSync } = await import("child_process");
  const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
  const { tmpdir } = await import("os");
  const path = await import("path");

  const ts = Date.now();
  const tmpIn = path.join(tmpdir(), `pdf-in-${ts}.pdf`);
  const tmpOut = path.join(tmpdir(), `pdf-out-${ts}.txt`);
  const workerPath = path.resolve(
    process.cwd(),
    "lib/files/pdf-extract-worker.mjs"
  );

  try {
    // PDFを一時ファイルに書き出し
    writeFileSync(tmpIn, buffer);

    // 別プロセスで抽出（独自のメモリ空間で動作）
    execFileSync("node", ["--max-old-space-size=2048", workerPath, tmpIn, tmpOut], {
      timeout: 120_000,
    });

    return readFileSync(tmpOut, "utf-8");
  } finally {
    // 一時ファイルを削除
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
    try { unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

async function extractPdfWithPdfParse(buffer: Buffer): Promise<string> {
  ensurePdfJsNodePolyfills();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    try {
      await parser.destroy();
    } catch {
      // ignore cleanup errors
    }
  }
}

async function extractPdfInProcess(buffer: Buffer): Promise<string> {
  ensurePdfJsNodePolyfills();
  const path = await import("path");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjsLib.GlobalWorkerOptions.workerSrc = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );

  const doc = await pdfjsLib
    .getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    })
    .promise;

  try {
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => {
            if ("str" in item && typeof item.str === "string") {
              return item.str;
            }
            return "";
          })
          .filter(Boolean)
          .join(" ");
        if (text.trim()) pages.push(text);
      } finally {
        page.cleanup();
      }
    }

    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

async function extractOffice(buffer: Buffer): Promise<string> {
  const { parseOffice } = await import("officeparser");
  const ast = await parseOffice(buffer);
  return ast.toText();
}

async function extractExcel(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    lines.push(`## ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(csv);
    lines.push("");
  }

  return lines.join("\n");
}
