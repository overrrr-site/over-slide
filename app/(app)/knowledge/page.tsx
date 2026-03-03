"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface KnowledgeDoc {
  id: string;
  title: string;
  file_name: string;
  doc_type: string;
  purpose: string;
  tags: string[];
  analysis_status: string;
  created_at: string;
}

interface KnowledgeChunk {
  chunk_type: string;
  content: string;
  metadata: Record<string, unknown>;
}

type PreviewTab = "structure" | "details" | "review";

const PREVIEW_TABS: { key: PreviewTab; label: string; description: string }[] = [
  { key: "structure", label: "構成を作るとき", description: "提案書の骨組みを自動生成する場面で使われます" },
  { key: "details", label: "詳細を書くとき", description: "各ページの本文を生成する場面で使われます" },
  { key: "review", label: "レビューするとき", description: "完成した提案書をチェックする場面で使われます" },
];

// モードBのタグ選択肢
const TAG_OPTIONS: Record<string, string[]> = {
  "業種": ["IT", "製造", "小売", "食品", "医療", "金融", "その他"],
  "案件タイプ": ["新規提案", "継続提案", "改善提案", "調査報告", "戦略提案"],
  "クライアント規模": ["スタートアップ", "中小企業", "大企業", "官公庁"],
  "特殊タグ": ["レビュー基準", "判断軸"],
};

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<"style" | "content">("style");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [purposeFilter, setPurposeFilter] = useState<"all" | "style" | "content">("all");
  const [showPreview, setShowPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("structure");
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [styleGuideText, setStyleGuideText] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const supabase = createClient();

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge_docs")
      .select("id, title, file_name, doc_type, purpose, tags, analysis_status, created_at")
      .order("created_at", { ascending: false });
    if (data) setDocs(data);
  }, [supabase]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Poll every 5s while processing or if any doc is "analyzing"
  useEffect(() => {
    const hasAnalyzing = docs.some((d) => d.analysis_status === "analyzing");
    if (!processing && !hasAnalyzing) return;

    const interval = setInterval(() => {
      fetchDocs();
    }, 5000);
    return () => clearInterval(interval);
  }, [processing, docs, fetchDocs]);

  const handleVectorize = useCallback(async (docId: string) => {
    setProcessing(docId);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/vectorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      const data = await res.json().catch(() => ({ error: `サーバーエラー (${res.status})` }));
      if (!res.ok) throw new Error(data.error || "ベクトル化に失敗しました");
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(
          "サーバーとの接続が切れました。処理に時間がかかりすぎた可能性があります。ページを再読み込みしてからもう一度お試しください。"
        );
      } else {
        setError(err instanceof Error ? err.message : "ベクトル化に失敗しました");
      }
    } finally {
      setProcessing(null);
    }

    await fetchDocs();
  }, [fetchDocs]);

  const handleAnalyze = useCallback(async (docId: string) => {
    setProcessing(docId);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      const data = await res.json().catch(() => ({ error: `サーバーエラー (${res.status})` }));
      if (!res.ok) throw new Error(data.error || "分析に失敗しました");

      // Auto-vectorize after analysis
      await handleVectorize(docId);
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(
          "サーバーとの接続が切れました。処理に時間がかかりすぎた可能性があります。ページを再読み込みしてからもう一度お試しください。"
        );
      } else {
        setError(err instanceof Error ? err.message : "分析に失敗しました");
      }
      setProcessing(null);
    }

    await fetchDocs();
  }, [fetchDocs, handleVectorize]);

  // ファイル選択 → モーダル表示
  const prepareUpload = useCallback((file: File) => {
    const allowedExts = [".pdf", ".pptx", ".docx", ".xlsx", ".csv", ".txt", ".md"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      setError(`対応していないファイル形式です: ${fileExt}`);
      return;
    }
    setPendingFile(file);
    setUploadPurpose(purposeFilter === "content" ? "content" : "style");
    setUploadTags([]);
    setShowUploadModal(true);
  }, [purposeFilter]);

  // モーダル確定 → 実アップロード
  const confirmUpload = useCallback(async () => {
    if (!pendingFile) return;
    setShowUploadModal(false);
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("title", pendingFile.name.replace(/\.[^/.]+$/, ""));
    formData.append("purpose", uploadPurpose);
    formData.append("tags", JSON.stringify(uploadTags));

    try {
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      await fetchDocs();

      // モードA → スタイル解析、モードB → ベクトル化
      // 少し待ってからAPIを呼ぶ（サーバー側のコンパイル完了・GCを待つ）
      await new Promise((r) => setTimeout(r, 3000));
      if (uploadPurpose === "style") {
        await handleAnalyze(data.id);
      } else {
        await handleVectorize(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  }, [pendingFile, uploadPurpose, uploadTags, fetchDocs, handleAnalyze, handleVectorize]);

  const toggleTag = useCallback((tag: string) => {
    setUploadTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    prepareUpload(file);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    prepareUpload(file);
  }, [prepareUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDelete = useCallback(async (docId: string) => {
    if (!confirm("このドキュメントを削除しますか？")) return;
    setDeleting(docId);
    setError(null);

    try {
      const res = await fetch(`/api/knowledge/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "削除に失敗しました");
      }
      await fetchDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  }, [fetchDocs]);

  const fetchPreviewData = useCallback(async () => {
    setLoadingPreview(true);
    try {
      // チャンクとスタイルガイドを同時に取得
      const [chunkRes, sgRes] = await Promise.all([
        supabase
          .from("knowledge_chunks")
          .select("chunk_type, content, metadata")
          .order("created_at", { ascending: true }),
        fetch("/api/style-guide").then((r) => r.json()),
      ]);

      if (chunkRes.data) setChunks(chunkRes.data);

      // スタイルガイドをテキスト化
      const sg = sgRes?.data;
      if (sg) {
        const parts: string[] = [];
        if (sg.composition_patterns?.text) parts.push(`── 構成パターン ──\n${sg.composition_patterns.text}`);
        if (sg.tone?.text) parts.push(`── 文体・トーン ──\n${sg.tone.text}`);
        if (sg.information_density?.text) parts.push(`── 情報密度 ──\n${sg.information_density.text}`);
        if (sg.phrases?.text) parts.push(`── 指摘フレーズ ──\n${sg.phrases.text}`);
        if (sg.custom_rules?.length > 0) {
          parts.push(`── レビュー優先順位 ──\n${sg.custom_rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`);
        }
        setStyleGuideText(parts.join("\n\n"));
      }
    } catch {
      // プレビュー取得失敗は致命的でない
    } finally {
      setLoadingPreview(false);
    }
  }, [supabase]);

  const handleTogglePreview = useCallback(async () => {
    if (!showPreview) {
      await fetchPreviewData();
    }
    setShowPreview((prev) => !prev);
  }, [showPreview, fetchPreviewData]);

  // 場面ごとにチャンクをフィルタリング
  const getChunksForTab = useCallback((tab: PreviewTab) => {
    switch (tab) {
      case "structure":
        return chunks.filter((c) => ["composition", "page", "correction"].includes(c.chunk_type));
      case "details":
        return chunks.filter((c) => ["style", "expression", "correction"].includes(c.chunk_type));
      case "review":
        return chunks.filter((c) => c.chunk_type === "reviewer_profile");
    }
  }, [chunks]);

  // チャンクの種類ラベル
  const chunkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      composition: "構成パターン",
      page: "ページ別分析",
      style: "文体分析",
      expression: "再利用フレーズ",
      correction: "修正から学んだこと",
      content: "内容テキスト",
      reviewer_profile: "レビュアー基準",
    };
    return labels[type] || type;
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "待機中", color: "bg-status-draft-bg text-status-draft-text" },
      analyzing: { label: "分析中...", color: "bg-status-warning-bg text-status-warning-text" },
      analyzed: { label: "分析完了", color: "bg-status-active-bg text-status-active-text" },
      vectorized: { label: "ベクトル化済", color: "bg-status-success-bg text-status-success-text" },
      error: { label: "エラー", color: "bg-status-error-bg text-status-error-text" },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div
      className="mx-auto w-full max-w-6xl p-6"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">ナレッジベース</h1>
          <p className="mt-1 text-sm text-text-secondary">
            過去の提案書をアップロードすると、構成・文体・表現パターンを学習し、新しい提案書の生成に活用します。
          </p>
        </div>
        <label className="cursor-pointer rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-green focus-within:ring-offset-2">
          {uploading ? "アップロード中..." : "ファイルを追加"}
          <input
            type="file"
            accept=".pdf,.pptx,.docx,.xlsx,.csv,.txt,.md"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Drag & drop overlay */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-navy/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-navy bg-white/90 px-12 py-8 text-center shadow-lg">
            <p className="text-lg font-bold text-navy">ここにドロップ</p>
            <p className="mt-1 text-sm text-text-secondary">ファイルをアップロードします</p>
          </div>
        </div>
      )}

      {/* アップロードモーダル */}
      {showUploadModal && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">アップロード設定</h2>
            <p className="mt-1 text-xs text-text-secondary">{pendingFile.name}</p>

            {/* モード選択 */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-text-primary">用途を選択</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadPurpose("style")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-colors ${
                    uploadPurpose === "style" ? "border-navy bg-navy/5" : "border-beige"
                  }`}
                >
                  <p className={`text-sm font-medium ${uploadPurpose === "style" ? "text-navy" : "text-text-primary"}`}>
                    スタイル学習
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">文体・構成・表現パターンを抽出し、書き方に反映</p>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadPurpose("content")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-colors ${
                    uploadPurpose === "content" ? "border-navy bg-navy/5" : "border-beige"
                  }`}
                >
                  <p className={`text-sm font-medium ${uploadPurpose === "content" ? "text-navy" : "text-text-primary"}`}>
                    内容参照
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">似た案件を探すときの参考情報として保存</p>
                </button>
              </div>
            </div>

            {/* タグ選択（モードBのみ） */}
            {uploadPurpose === "content" && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-text-primary">タグを選択</label>
                <div className="space-y-3">
                  {Object.entries(TAG_OPTIONS).map(([category, options]) => (
                    <div key={category}>
                      <p className="mb-1 text-xs font-medium text-text-secondary">{category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                              uploadTags.includes(tag)
                                ? "bg-navy text-white"
                                : "bg-off-white text-text-secondary hover:bg-beige"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ボタン */}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowUploadModal(false); setPendingFile(null); }}
                className="flex-1 rounded-md border border-beige px-4 py-2 text-sm font-medium text-text-secondary hover:bg-off-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                className="flex-1 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90"
              >
                アップロード開始
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* AI指示プレビュー */}
      {docs.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleTogglePreview}
            className="flex items-center gap-2 rounded-lg border border-beige bg-white px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-off-white"
          >
            <span className={`inline-block transition-transform ${showPreview ? "rotate-90" : ""}`}>▶</span>
            AIに渡される指示をプレビュー
          </button>

          {showPreview && (
            <div className="mt-3 rounded-lg border border-beige bg-white">
              {/* タブ */}
              <div className="flex border-b border-beige">
                {PREVIEW_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPreviewTab(tab.key)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      previewTab === tab.key
                        ? "border-b-2 border-navy text-navy"
                        : "text-text-secondary hover:text-navy"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* コンテンツ */}
              <div className="p-5">
                {loadingPreview ? (
                  <p className="text-sm text-text-secondary animate-pulse">読み込み中...</p>
                ) : (
                  <>
                    <p className="mb-4 text-xs text-text-secondary">
                      {PREVIEW_TABS.find((t) => t.key === previewTab)?.description}
                    </p>

                    {/* レビュータブ: スタイルガイドを先に表示 */}
                    {previewTab === "review" && styleGuideText && (
                      <div className="mb-4">
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-green">
                          スタイルガイド
                        </h4>
                        <pre className="whitespace-pre-wrap rounded-md bg-off-white p-4 text-xs leading-relaxed text-text-primary">
                          {styleGuideText}
                        </pre>
                      </div>
                    )}

                    {/* チャンク一覧 */}
                    {(() => {
                      const tabChunks = getChunksForTab(previewTab);
                      if (tabChunks.length === 0 && (previewTab !== "review" || !styleGuideText)) {
                        return (
                          <div className="rounded-md border border-dashed border-beige p-6 text-center">
                            <p className="text-sm text-text-secondary">
                              まだナレッジが登録されていません
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              資料をアップロードして分析・ベクトル化すると、ここにAIへの指示が表示されます
                            </p>
                          </div>
                        );
                      }

                      // チャンクを種類ごとにグループ化
                      const grouped = tabChunks.reduce<Record<string, KnowledgeChunk[]>>((acc, chunk) => {
                        const key = chunk.chunk_type;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(chunk);
                        return acc;
                      }, {});

                      return (
                        <div className="space-y-4">
                          {Object.entries(grouped).map(([type, items]) => (
                            <div key={type}>
                              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
                                {chunkTypeLabel(type)}
                                <span className="ml-2 font-normal text-text-secondary">
                                  ({items.length}件)
                                </span>
                              </h4>
                              <div className="space-y-2">
                                {items.map((chunk, i) => {
                                  const source = (chunk.metadata?.docTitle as string) || "";
                                  return (
                                    <div
                                      key={i}
                                      className="rounded-md bg-off-white p-3"
                                    >
                                      {source && (
                                        <p className="mb-1 text-xs font-medium text-green">
                                          出典: {source}
                                        </p>
                                      )}
                                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
                                        {chunk.content.length > 500
                                          ? chunk.content.slice(0, 500) + "…"
                                          : chunk.content}
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-text-secondary">
                            合計: {tabChunks.length}件のナレッジ
                            {previewTab === "review" && styleGuideText ? " + スタイルガイド" : ""}
                          </p>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* タイプ分類フィルター */}
      {docs.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-1 rounded-lg bg-off-white p-1">
            {([
              { key: "all" as const, label: "すべて", count: docs.length },
              { key: "style" as const, label: "スタイル学習", count: docs.filter((d) => d.purpose === "style").length },
              { key: "content" as const, label: "内容参照", count: docs.filter((d) => d.purpose === "content").length },
            ]).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setPurposeFilter(f.key)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  purposeFilter === f.key
                    ? "bg-white text-navy shadow-sm"
                    : "text-text-secondary hover:text-navy"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs text-text-secondary">({f.count})</span>
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-text-secondary">
            {purposeFilter === "style"
              ? "文体・構成・表現パターンを抽出し、新しい提案書の書き方に反映します"
              : purposeFilter === "content"
                ? "テキストをそのまま保存し、似た案件を探すときの参考情報として使います"
                : "スタイル学習: 書き方を学ぶ資料 ／ 内容参照: 似た案件を探す資料"}
          </p>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
          <p className="text-sm text-text-secondary">
            まだドキュメントがありません。
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            PDF / PPTX / DOCX / XLSX / CSV / TXT をアップロードできます
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            ファイルをドラッグ＆ドロップ、または右上の「ファイルを追加」ボタンで追加
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.filter((doc) => purposeFilter === "all" || doc.purpose === purposeFilter).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-beige bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-medium text-navy">
                    {doc.title}
                  </h3>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    doc.purpose === "content"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green/10 text-green"
                  }`}>
                    {doc.purpose === "content" ? "内容参照" : "スタイル学習"}
                  </span>
                  {statusLabel(doc.analysis_status)}
                  {processing === doc.id && (
                    <span className="text-xs text-text-secondary animate-pulse">
                      処理中...
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
                  <span>{doc.file_name}</span>
                  <span>{doc.doc_type.toUpperCase()}</span>
                  <span>
                    {new Date(doc.created_at).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                {doc.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-beige/50 px-1.5 py-0.5 text-xs text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4 flex gap-2">
                {(doc.analysis_status === "pending" ||
                  doc.analysis_status === "analyzing" ||
                  doc.analysis_status === "error") && (
                  <button
                    onClick={() => handleAnalyze(doc.id)}
                    disabled={processing !== null}
                    className="rounded-lg border border-green px-3 py-1 text-xs font-medium text-green hover:bg-green/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                  >
                    {doc.analysis_status === "analyzing"
                      ? "再分析"
                      : doc.analysis_status === "error"
                        ? "再試行"
                        : "分析開始"}
                  </button>
                )}
                {doc.analysis_status === "analyzed" && (
                  <button
                    onClick={() => handleVectorize(doc.id)}
                    disabled={processing !== null}
                    className="rounded-lg border border-green px-3 py-1 text-xs font-medium text-green hover:bg-green/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                  >
                    ベクトル化
                  </button>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id || processing !== null}
                  className="rounded-lg border border-beige px-3 py-1 text-xs font-medium text-text-secondary hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                >
                  {deleting === doc.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
