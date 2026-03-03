import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { docId } = await request.json();
  if (!docId) {
    return NextResponse.json({ error: "docId is required" }, { status: 400 });
  }

  // Fetch document to validate
  const { data: doc, error: docError } = await supabase
    .from("knowledge_docs")
    .select("id, purpose, analysis, analysis_status")
    .eq("id", docId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // モードA（style）の場合は分析結果が必須
  if (doc.purpose !== "content" && !doc.analysis) {
    return NextResponse.json(
      { error: "Document must be analyzed first" },
      { status: 400 }
    );
  }

  // content 目的のみワーカーで処理（style はスタイルチャンクなので別処理）
  if (doc.purpose === "content") {
    // ワーカーを別プロセスで起動（メインサーバーのメモリに影響しない）
    const workerPath = path.resolve(
      process.cwd(),
      "scripts/vectorize-worker.mjs"
    );

    const child = spawn("node", [workerPath, docId], {
      detached: true,
      stdio: "ignore",
      env: process.env as NodeJS.ProcessEnv,
    });
    child.unref();

    return NextResponse.json({
      docId,
      status: "processing",
      message: "ベクトル化をバックグラウンドで開始しました",
    });
  }

  // モードA: スタイルチャンクはデータが小さいのでインプロセスで処理
  const { createChunks } = await import("@/lib/knowledge/chunker");
  const { embedTexts } = await import("@/lib/knowledge/embeddings");

  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const chunks = createChunks(doc.analysis, doc.purpose);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks created" },
        { status: 400 }
      );
    }

    const docTags: string[] = [];
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedTexts(texts, controller.signal);

    // Delete existing chunks
    await supabase.from("knowledge_chunks").delete().eq("doc_id", docId);

    const rows = chunks.map((chunk, i) => ({
      doc_id: docId,
      chunk_type: chunk.chunkType,
      content: chunk.content,
      metadata: { ...chunk.metadata, purpose: doc.purpose },
      embedding: JSON.stringify(embeddings[i]),
    }));

    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert(rows);

    if (insertError) {
      throw new Error(`チャンクの保存に失敗しました: ${insertError.message}`);
    }

    await supabase
      .from("knowledge_docs")
      .update({ analysis_status: "vectorized" })
      .eq("id", docId);

    return NextResponse.json({ docId, chunksCreated: chunks.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ベクトル化に失敗しました";
    console.error(`[Vectorize Error] docId=${docId}:`, err);

    await supabase
      .from("knowledge_docs")
      .update({ analysis_status: "error" })
      .eq("id", docId);

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(abortTimeout);
  }
}
