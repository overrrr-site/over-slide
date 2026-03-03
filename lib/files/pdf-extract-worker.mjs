/**
 * PDF text extraction worker.
 * Runs in a separate process to isolate memory usage from the main server.
 * Usage: node pdf-extract-worker.mjs <input.pdf> <output.txt>
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    process.stderr.write("Usage: node pdf-extract-worker.mjs <input.pdf> <output.txt>");
    process.exit(1);
  }

  const buffer = readFileSync(inputPath);

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => typeof item.str === "string")
      .map((item) => item.str)
      .join(" ");
    if (text.trim()) pages.push(text);
    page.cleanup();
  }

  doc.destroy();
  writeFileSync(outputPath, pages.join("\n\n"), "utf-8");
}

main().catch((err) => {
  process.stderr.write(err.message || "PDF extraction failed");
  process.exit(1);
});
