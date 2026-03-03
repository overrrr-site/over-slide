"use client";

import { Icon } from "@iconify/react";
import { BRIEF_FIELD_CONFIG } from "./research-types";
import type { useResearchWorkspace } from "./use-research-workspace";

type WorkspaceState = ReturnType<typeof useResearchWorkspace>;

type Props = Pick<
  WorkspaceState,
  | "briefFields"
  | "savingBrief"
  | "briefNotice"
  | "updateBriefField"
  | "saveBriefSheet"
  | "topicSuggestions"
  | "aiSuggestions"
  | "addedQueries"
  | "handleSuggestKeywords"
  | "suggestingKeywords"
  | "briefMarkdown"
  | "keywords"
  | "updateKeywords"
  | "handleSearch"
  | "searching"
  | "runningAutonomous"
  | "queryList"
  | "searchResults"
  | "clearSearchResults"
  | "clearKeywordsAndSuggestions"
  | "generateMemo"
  | "isStreaming"
  | "activeRequestMode"
  | "runAutonomousResearch"
  | "autonomousSummary"
  | "completeResearch"
  | "streamingMemoText"
  | "memoDraft"
>;

export function ResearchControlsPanel(props: Props) {
  const {
    briefFields,
    savingBrief,
    briefNotice,
    updateBriefField,
    saveBriefSheet,
    topicSuggestions,
    aiSuggestions,
    addedQueries,
    handleSuggestKeywords,
    suggestingKeywords,
    briefMarkdown,
    keywords,
    updateKeywords,
    handleSearch,
    searching,
    runningAutonomous,
    queryList,
    searchResults,
    clearSearchResults,
    clearKeywordsAndSuggestions,
    generateMemo,
    isStreaming,
    activeRequestMode,
    runAutonomousResearch,
    autonomousSummary,
    completeResearch,
    streamingMemoText,
    memoDraft,
  } = props;

  return (
    <div className="w-96 overflow-auto border-r border-beige bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-navy">リサーチ設定</h2>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            ブリーフシート（追記・修正）
          </label>
          <button
            onClick={() => void saveBriefSheet()}
            disabled={savingBrief}
            className="rounded border border-green px-2 py-1 text-[11px] font-medium text-green transition-colors hover:bg-green/10 disabled:opacity-50"
          >
            {savingBrief ? "保存中..." : "ブリーフ保存"}
          </button>
        </div>

        <div className="space-y-2">
          {BRIEF_FIELD_CONFIG.map((field) => (
            <div key={field.key}>
              <label className="text-[11px] font-medium text-text-secondary">
                {field.label}
              </label>
              <textarea
                value={briefFields[field.key]}
                onChange={(event) => updateBriefField(field.key, event.target.value)}
                rows={field.rows}
                className="mt-1 w-full rounded border border-beige bg-off-white px-2 py-1.5 text-xs text-text-primary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>
          ))}
        </div>

        {briefNotice && (
          <p className="mt-1 text-[11px] text-text-secondary">{briefNotice}</p>
        )}
      </div>

      {(topicSuggestions.length > 0 || aiSuggestions.length > 0) && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              キーワード候補（クエリ化済み）
            </label>
            <button
              onClick={clearKeywordsAndSuggestions}
              className="text-[11px] text-text-secondary transition-colors hover:text-navy"
            >
              すべてクリア
            </button>
          </div>
          <p className="mt-0.5 text-[10px] text-text-secondary">
            候補は検索キーワード欄に自動で追加されます
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topicSuggestions.map((suggestion, index) => {
              const isAdded = addedQueries.has(suggestion.query);
              return (
                <div
                  key={`topic-${index}`}
                  title={
                    suggestion.source
                      ? `${suggestion.source} → ${suggestion.query}`
                      : suggestion.purpose
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isAdded
                      ? "border-beige bg-off-white text-text-secondary"
                      : "border-beige bg-white text-text-primary"
                  }`}
                >
                  <Icon icon="mdi:text-search" className="h-3 w-3 shrink-0" />
                  <span className="max-w-[200px] truncate">{suggestion.query}</span>
                  {isAdded && <Icon icon="mdi:check" className="h-3 w-3 shrink-0 text-green" />}
                </div>
              );
            })}
            {aiSuggestions.map((suggestion, index) => {
              const isAdded = addedQueries.has(suggestion.query);
              return (
                <div
                  key={`ai-${index}`}
                  title={suggestion.purpose}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isAdded
                      ? "border-green/30 bg-green/5 text-text-secondary"
                      : "border-green/50 bg-green/10 text-green"
                  }`}
                >
                  <Icon icon="mdi:auto-fix" className="h-3 w-3 shrink-0" />
                  <span className="max-w-[200px] truncate">{suggestion.query}</span>
                  {isAdded && <Icon icon="mdi:check" className="h-3 w-3 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => void handleSuggestKeywords()}
        disabled={suggestingKeywords || !briefMarkdown.trim()}
        className="mb-4 w-full rounded-md border border-green bg-white px-4 py-1.5 text-xs font-medium text-green transition-colors hover:bg-green/10 disabled:opacity-50"
      >
        {suggestingKeywords ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:loading" className="h-3.5 w-3.5 animate-spin" />
            キーワード候補を生成中...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:auto-fix" className="h-3.5 w-3.5" />
            AIでキーワード候補を生成
          </span>
        )}
      </button>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            検索キーワード（1行1クエリ）
          </label>
          {keywords.trim() && (
            <button
              onClick={() => updateKeywords("")}
              className="text-[11px] text-text-secondary transition-colors hover:text-navy"
            >
              クリア
            </button>
          )}
        </div>
        <textarea
          value={keywords}
          onChange={(event) => updateKeywords(event.target.value)}
          rows={5}
          placeholder="DX 推進 事例&#10;業界名 トレンド 2025&#10;..."
          className="mt-1 w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
        />
      </div>

      <button
        onClick={() => void handleSearch()}
        disabled={searching || runningAutonomous || queryList.length === 0}
        className="mb-3 w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {searching ? "検索中..." : `Web検索 (${queryList.length}クエリ)`}
      </button>

      {searchResults.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">
              検索結果: {searchResults.length}件
            </p>
            <button
              onClick={clearSearchResults}
              className="text-xs text-text-secondary transition-colors hover:text-navy"
            >
              クリア
            </button>
          </div>
          <div className="max-h-40 space-y-1 overflow-auto">
            {searchResults.map((result, index) => (
              <div key={index} className="rounded bg-off-white p-1.5 text-xs">
                <p className="truncate font-medium text-navy">{result.title}</p>
                <p className="truncate text-text-secondary">{result.url}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={generateMemo}
        disabled={
          isStreaming ||
          runningAutonomous ||
          !!activeRequestMode ||
          (!searchResults.length && !keywords.trim())
        }
        className="mb-3 w-full rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
      >
        {isStreaming || activeRequestMode
          ? "リサーチメモ更新中..."
          : "リサーチメモを更新"}
      </button>

      <button
        onClick={() => void runAutonomousResearch()}
        disabled={
          runningAutonomous || isStreaming || !!activeRequestMode || !briefMarkdown.trim()
        }
        className="mb-3 w-full rounded-md bg-navy/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy disabled:opacity-50"
      >
        {runningAutonomous ? "自走リサーチ実行中..." : "自走リサーチ開始（最大3周）"}
      </button>

      {autonomousSummary && (
        <div className="mb-3 rounded border border-beige bg-off-white p-2 text-xs text-text-secondary">
          <p>
            停止理由:{" "}
            {autonomousSummary.stopReason === "resolved"
              ? "未解決論点なし"
              : "最大3周に到達"}
          </p>
          <p>実行周回: {autonomousSummary.iterations.length} 回</p>
          {autonomousSummary.remainingIssues.length > 0 && (
            <div className="mt-1">
              <p className="font-medium text-text-primary">残論点:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {autonomousSummary.remainingIssues.map((issue, index) => (
                  <li key={`${issue}-${index}`}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => void completeResearch()}
        disabled={runningAutonomous || !(streamingMemoText || memoDraft).trim()}
        className="w-full rounded-md border border-green px-4 py-2 text-sm font-medium text-green transition-colors hover:bg-green/10 disabled:opacity-50"
      >
        リサーチ完了 → 構成作成へ
      </button>
    </div>
  );
}
