/**
 * Convert HTML slides to a PDF buffer using Puppeteer.
 *
 * - Server (Vercel etc.): uses @sparticuz/chromium + puppeteer-core
 * - Local dev: uses full puppeteer (bundled Chrome)
 */

import { buildSlideDocument, SLIDE_WIDTH, SLIDE_HEIGHT } from "./base-styles";
import type { HtmlSlide } from "./types";

/** Millimeter dimensions for 16:9 slides (roughly 10" x 5.625") */
const PAGE_WIDTH_MM = 254;
const PAGE_HEIGHT_MM = 142.88;

const IS_SERVER = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

export interface PdfConvertOptions {
  /** Timeout in ms for the entire conversion (default: 60_000) */
  timeout?: number;
}

/**
 * Launch a headless Chrome browser.
 * On serverless (Vercel/Lambda) uses the lightweight @sparticuz/chromium binary.
 * Locally falls back to the full puppeteer package with its bundled Chrome.
 */
async function launchBrowser() {
  if (IS_SERVER) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev: use full puppeteer
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });
}

export async function convertSlidesToPdf(
  slides: HtmlSlide[],
  options: PdfConvertOptions = {}
): Promise<Buffer> {
  const { timeout = 60_000 } = options;

  const browser = await launchBrowser();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await browser.newPage() as any;

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
