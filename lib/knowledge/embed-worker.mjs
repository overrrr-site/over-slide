/**
 * Embedding worker — runs in a separate process to isolate memory.
 * Usage: node embed-worker.mjs <input.json> <output.json>
 *
 * input.json:  { texts: string[], inputType: "document" | "query" }
 * output.json: { embeddings: number[][] }
 *
 * Requires VOYAGE_API_KEY env var.
 */

import { readFileSync, writeFileSync } from "fs";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";
const BATCH_SIZE = 16;
const TIMEOUT_MS = 60_000;

async function callVoyage(batch, inputType, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        model: MODEL,
        input: batch,
        input_type: inputType,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Voyage AI error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    process.stderr.write(
      "Usage: node embed-worker.mjs <input.json> <output.json>\n"
    );
    process.exit(1);
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    process.stderr.write("VOYAGE_API_KEY is not set\n");
    process.exit(1);
  }

  const { texts, inputType } = JSON.parse(readFileSync(inputPath, "utf-8"));

  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callVoyage(batch, inputType || "document", apiKey);
    allEmbeddings.push(...embeddings);
  }

  writeFileSync(outputPath, JSON.stringify({ embeddings: allEmbeddings }), "utf-8");
}

main().catch((err) => {
  process.stderr.write(err.message || "Embedding failed");
  process.exit(1);
});
