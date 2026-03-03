/**
 * Vectorize Worker — runs as a completely separate process.
 *
 * Usage: node scripts/vectorize-worker.mjs <docId>
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY
 *
 * Steps:
 *   1. Fetch doc record from Supabase
 *   2. Download .extracted.txt from storage
 *   3. Create content chunks
 *   4. Call Voyage AI for embeddings
 *   5. Save chunks + embeddings to database
 *   6. Update doc status
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const BATCH_SIZE = 16;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// ---- Supabase client (minimal, no heavy SDK) ----

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip, deflate",
  };

  return {
    async selectDoc(docId) {
      const res = await fetch(
        `${url}/rest/v1/knowledge_docs?id=eq.${docId}&select=*`,
        { headers }
      );
      if (!res.ok) throw new Error(`DB select failed: ${res.status}`);
      const rows = await res.json();
      return rows[0] || null;
    },

    async updateDoc(docId, data) {
      const res = await fetch(
        `${url}/rest/v1/knowledge_docs?id=eq.${docId}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`DB update failed: ${res.status} ${body}`);
      }
    },

    async downloadFile(path) {
      const res = await fetch(
        `${url}/storage/v1/object/uploads/${path}`,
        {
          headers: {
            apikey: headers.apikey,
            Authorization: headers.Authorization,
            "Accept-Encoding": "gzip, deflate",
          },
        }
      );
      if (!res.ok) throw new Error(`Storage download failed: ${res.status}`);
      return res.text();
    },

    async deleteChunks(docId) {
      const res = await fetch(
        `${url}/rest/v1/knowledge_chunks?doc_id=eq.${docId}`,
        { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } }
      );
      if (!res.ok) throw new Error(`Delete chunks failed: ${res.status}`);
    },

    async insertChunks(rows) {
      const res = await fetch(`${url}/rest/v1/knowledge_chunks`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Insert chunks failed: ${res.status} ${body}`);
      }
    },
  };
}

// ---- Content chunker (index-based, V8 ConsString safe) ----

function createContentChunks(text, docTitle) {
  const chunks = [];
  let chunkStart = 0;
  let chunkIndex = 0;
  const minAdvance = CHUNK_SIZE - CHUNK_OVERLAP;

  while (chunkStart < text.length) {
    let chunkEnd = Math.min(chunkStart + CHUNK_SIZE, text.length);

    if (chunkEnd < text.length) {
      const paraBreak = text.lastIndexOf("\n\n", chunkEnd);
      if (paraBreak > chunkStart + CHUNK_SIZE / 2) {
        chunkEnd = paraBreak;
      } else {
        const periodIdx = text.lastIndexOf("。", chunkEnd);
        if (periodIdx > chunkStart + CHUNK_SIZE / 2) {
          chunkEnd = periodIdx + 1;
        }
      }
    }

    const content = text.substring(chunkStart, chunkEnd).trim();
    if (content) {
      chunks.push({
        chunkType: "content",
        content,
        metadata: { docTitle, section: "content", chunkIndex },
      });
      chunkIndex++;
    }

    chunkStart =
      chunkEnd > chunkStart + minAdvance
        ? chunkEnd - CHUNK_OVERLAP
        : chunkStart + minAdvance;
  }

  return chunks;
}

// ---- Voyage AI embeddings ----

async function callVoyage(batch, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch,
        input_type: "document",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Voyage AI error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } finally {
    clearTimeout(timeout);
  }
}

async function embedTexts(texts, apiKey) {
  const allEmbeddings = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(
      `  embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`
    );
    const embeddings = await callVoyage(batch, apiKey);
    allEmbeddings.push(...embeddings);
  }
  return allEmbeddings;
}

// ---- Main ----

async function main() {
  const docId = process.argv[2];
  if (!docId) {
    console.error("Usage: node scripts/vectorize-worker.mjs <docId>");
    process.exit(1);
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) {
    console.error("VOYAGE_API_KEY is required");
    process.exit(1);
  }

  const db = createSupabaseClient();

  console.log(`[VectorizeWorker] docId=${docId} — 開始`);

  // 1. Fetch doc
  const doc = await db.selectDoc(docId);
  if (!doc) {
    console.error(`Document not found: ${docId}`);
    process.exit(1);
  }

  console.log(
    `[VectorizeWorker] file=${doc.file_name} purpose=${doc.purpose}`
  );

  try {
    // 3. Download extracted text
    const textPath = doc.storage_path + ".extracted.txt";
    console.log(`[VectorizeWorker] テキストダウンロード中...`);
    const text = await db.downloadFile(textPath);

    if (!text || text.trim().length === 0) {
      throw new Error("抽出済みテキストが空です");
    }
    console.log(`[VectorizeWorker] テキスト取得完了 (${text.length}文字)`);

    // 4. Create chunks
    const chunks = createContentChunks(text, doc.title);
    console.log(`[VectorizeWorker] チャンク生成完了 (${chunks.length}件)`);

    if (chunks.length === 0) {
      throw new Error("チャンクを生成できませんでした");
    }

    // 5. Generate embeddings
    const texts = chunks.map((c) => c.content);
    console.log(`[VectorizeWorker] embedding開始...`);
    const embeddings = await embedTexts(texts, voyageKey);
    console.log(`[VectorizeWorker] embedding完了 (${embeddings.length}件)`);

    // 6. Delete existing chunks
    await db.deleteChunks(docId);

    // 7. Insert new chunks
    const docTags = doc.tags || [];
    const rows = chunks.map((chunk, i) => ({
      doc_id: docId,
      chunk_type: chunk.chunkType,
      content: chunk.content,
      metadata: { ...chunk.metadata, tags: docTags, purpose: doc.purpose },
      embedding: JSON.stringify(embeddings[i]),
    }));

    console.log(`[VectorizeWorker] DB保存中...`);
    await db.insertChunks(rows);

    // 8. Update status
    await db.updateDoc(docId, { analysis_status: "vectorized" });

    console.log(
      `[VectorizeWorker] 完了 — ${chunks.length} chunks saved`
    );
  } catch (err) {
    console.error(`[VectorizeWorker] エラー:`, err.message || err);
    await db.updateDoc(docId, { analysis_status: "error" }).catch(() => {});
    process.exit(1);
  }
}

main();
