import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "pdfjs-dist",
    "officeparser",
    "xlsx",
    "ai",
    "@ai-sdk/anthropic",
    "@ai-sdk/google",
    "@ai-sdk/openai",
    "zod",
    "sharp",
    "docx",
    "pptxgenjs",
    "pdf-parse",
  ],
};

export default nextConfig;
