/**
 * Convert HTML slides to a PDF buffer using Puppeteer.
 *
 * Launches a headless Chrome instance, renders all slides in a single
 * HTML document, waits for fonts to load, and prints to PDF at 16:9.
 */

import { buildSlideDocument, SLIDE_WIDTH, SLIDE_HEIGHT } from "./base-styles";
import type { HtmlSlide } from "./types";

/** Millimeter dimensions for 16:9 slides (roughly 10" x 5.625") */
const PAGE_WIDTH_MM = 254;
const PAGE_HEIGHT_MM = 142.88;

export interface PdfConvertOptions {
  /** Timeout in ms for the entire conversion (default: 60_000) */
  timeout?: number;
}

export async function convertSlidesToPdf(
  slides: HtmlSlide[],
  options: PdfConvertOptions = {}
): Promise<Buffer> {
  const { timeout = 60_000 } = options;

  // Dynamic import — puppeteer is listed in serverExternalPackages
  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set viewport to slide dimensions
    await page.setViewport({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      deviceScaleFactor: 2,
    });

    const htmlDoc = buildSlideDocument(slides.map((s) => s.html));

    await page.setContent(htmlDoc, {
      waitUntil: "networkidle0",
      timeout,
    });

    // Wait for Google Fonts to finish loading
    await page.evaluate(() =>
      (document as Document).fonts.ready.then(() => true)
    );

    // Small extra delay to let fonts render
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      width: `${PAGE_WIDTH_MM}mm`,
      height: `${PAGE_HEIGHT_MM}mm`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
