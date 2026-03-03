/**
 * Voyage AI embedding client.
 * Uses voyage-3 model (1024 dimensions).
 *
 * embedTexts runs in a child process to isolate memory from the dev server.
 * embedQuery runs in-process (small payload, no memory concern).
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";
const VOYAGE_TIMEOUT_MS = 60_000; // 60 seconds per batch

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
export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY が設定されていません。.env ファイルに Voyage AI の API キーを設定してください。"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOYAGE_TIMEOUT_MS);

  try {
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
    return data.data[0].embedding;
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
