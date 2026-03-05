/**
 * Voyage AI embedding client.
 * Uses voyage-3 model (1024 dimensions).
 *
 * embedTexts runs in a child process to isolate memory from the dev server.
 * embedQuery runs in-process (small payload, no memory concern).
 */
import { createHash } from "crypto";
import { REQUEST_FINGERPRINT_VERSION } from "@/lib/ai/cache-metadata";
import {
  buildSemanticCacheKey,
  getCachedText,
  setCachedText,
} from "@/lib/ai/semantic-cache";
import { createClient } from "@/lib/supabase/server";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";
const VOYAGE_TIMEOUT_MS = 60_000; // 60 seconds per batch
const EMBED_QUERY_ENDPOINT = "/knowledge/embed-query";

interface VoyageResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    total_tokens: number;
  };
}

/**
 * Generate embeddings for a batch of texts.
 * Runs in a separate child process to avoid OOM in the dev server.
 */
export async function embedTexts(
  texts: string[],
  _signal?: AbortSignal
): Promise<number[][]> {
  if (_signal?.aborted) {
    throw new Error("Embedding generation was aborted");
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY が設定されていません。.env ファイルに Voyage AI の API キーを設定してください。"
    );
  }

  const { execFileSync } = await import("child_process");
  const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
  const { tmpdir } = await import("os");
  const path = await import("path");

  const ts = Date.now();
  const tmpIn = path.join(tmpdir(), `embed-in-${ts}.json`);
  const tmpOut = path.join(tmpdir(), `embed-out-${ts}.json`);
  const workerPath = path.resolve(
    process.cwd(),
    "lib/knowledge/embed-worker.mjs"
  );

  try {
    writeFileSync(tmpIn, JSON.stringify({ texts, inputType: "document" }), "utf-8");

    execFileSync("node", [workerPath, tmpIn, tmpOut], {
      timeout: 300_000, // 5 minutes max
      env: { ...process.env, VOYAGE_API_KEY: apiKey },
    });

    const result = JSON.parse(readFileSync(tmpOut, "utf-8"));
    return result.embeddings;
  } catch (err) {
    if (err instanceof Error && "stderr" in err) {
      const stderr = (err as { stderr: Buffer }).stderr?.toString() || "";
      if (stderr) {
        throw new Error(`ベクトル化ワーカーエラー: ${stderr}`);
      }
    }
    throw err;
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
    try { unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

/**
 * Generate a single embedding for a query text.
 * Runs in-process (single text, small memory footprint).
 */
export async function embedQuery(
  text: string,
  teamId?: string | null
): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY が設定されていません。.env ファイルに Voyage AI の API キーを設定してください。"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOYAGE_TIMEOUT_MS);
  const strictFingerprint = createHash("sha256")
    .update(text)
    .digest("hex");
  const cacheKey = buildSemanticCacheKey({
    endpoint: EMBED_QUERY_ENDPOINT,
    model: MODEL,
    requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
    strictFingerprint,
  });

  try {
    if (teamId) {
      const supabase = await createClient();
      const cached = await getCachedText({
        supabase,
        teamId,
        endpoint: EMBED_QUERY_ENDPOINT,
        model: MODEL,
        cacheKey,
      });

      if (cached?.text) {
        try {
          const parsed = JSON.parse(cached.text) as {
            embedding?: number[];
          };
          if (Array.isArray(parsed.embedding) && parsed.embedding.length > 0) {
            return parsed.embedding;
          }
        } catch {
          // Ignore stale cache payloads and regenerate.
        }
      }
    }

    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [text],
        input_type: "query",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Voyage AI がエラーを返しました (${response.status}): ${errorBody}`
      );
    }

    const data: VoyageResponse = await response.json();
    const embedding = data.data[0].embedding;

    if (teamId) {
      const supabase = await createClient();
      await setCachedText({
        supabase,
        teamId,
        endpoint: EMBED_QUERY_ENDPOINT,
        model: MODEL,
        cacheKey,
        text: JSON.stringify({ embedding }),
        usage: {
          inputTokens: data.usage.total_tokens,
          outputTokens: 0,
          totalTokens: data.usage.total_tokens,
        },
        metadata: {
          strictFingerprint,
          requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
        },
        ttlHours: 168,
      });
    }

    return embedding;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "Voyage AI への接続がタイムアウトしました。しばらく待ってから再度お試しください。"
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
