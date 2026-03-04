/**
 * PDF text extraction worker.
 * Runs in a separate process to isolate memory usage from the main server.
 * Usage: node pdf-extract-worker.mjs <input.pdf> <output.txt>
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function ensurePdfJsNodePolyfills() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    class DOMMatrixPolyfill {
      constructor(_init) {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
      }

      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translateSelf() { return this; }
      scaleSelf() { return this; }
      rotateSelf() { return this; }
      invertSelf() { return this; }
      clone() { return new DOMMatrixPolyfill(); }

      transformPoint(point) {
        return {
          x: point?.x ?? 0,
          y: point?.y ?? 0,
          z: point?.z ?? 0,
          w: point?.w ?? 1,
        };
      }

      static fromMatrix() {
        return new DOMMatrixPolyfill();
      }
    }

    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof globalThis.Path2D === "undefined") {
    class Path2DPolyfill {
      addPath(_path) {}
    }
    globalThis.Path2D = Path2DPolyfill;
  }

  if (typeof globalThis.ImageData === "undefined") {
    class ImageDataPolyfill {
      constructor(dataOrWidth, width, height) {
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
    globalThis.ImageData = ImageDataPolyfill;
  }
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    process.stderr.write("Usage: node pdf-extract-worker.mjs <input.pdf> <output.txt>");
    process.exit(1);
  }

  const buffer = readFileSync(inputPath);
  ensurePdfJsNodePolyfills();

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
