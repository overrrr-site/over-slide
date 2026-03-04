/**
 * Text extraction from uploaded files.
 * Supports: PDF, Office docs, spreadsheets, text files, image files
 */

export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return extractPdf(buffer);
    case "ppt":
    case "pptx":
    case "doc":
    case "docx":
      return extractOffice(buffer);
    case "xls":
    case "xlsx":
      return extractExcel(buffer);
    case "csv":
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "bmp":
    case "heic":
    case "heif":
      return "";
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    return await extractPdfWithWorker(buffer);
  } catch (workerError) {
    console.warn("[extractPdf] Worker extraction failed. Falling back to pdf-parse.", {
      error: workerError instanceof Error ? workerError.message : String(workerError),
    });
    return extractPdfWithPdfParse(buffer);
  }
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
