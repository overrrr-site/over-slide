"use client";

import type { useResearchWorkspace } from "./use-research-workspace";

type WorkspaceState = ReturnType<typeof useResearchWorkspace>;

type Props = Pick<
  WorkspaceState,
  | "saveMemo"
  | "savingMemo"
  | "runningAutonomous"
  | "isStreaming"
  | "streamingMemoText"
  | "memoDraft"
  | "updateMemoDraft"
  | "memoNotice"
  | "error"
  | "chatHistory"
  | "activeRequestMode"
  | "messagesEndRef"
  | "chatInstruction"
  | "updateChatInstruction"
  | "sendChatInstruction"
  | "briefMarkdown"
>;

export function ResearchMemoPanel(props: Props) {
  const {
    saveMemo,
    savingMemo,
    runningAutonomous,
    isStreaming,
    streamingMemoText,
    memoDraft,
    updateMemoDraft,
    memoNotice,
    error,
    chatHistory,
    activeRequestMode,
    messagesEndRef,
    chatInstruction,
    updateChatInstruction,
    sendChatInstruction,
    briefMarkdown,
  } = props;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-lg border border-beige bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">リサーチメモ</h3>
            <button
              onClick={() => void saveMemo()}
              disabled={
                savingMemo ||
                runningAutonomous ||
                isStreaming ||
                !(streamingMemoText || memoDraft).trim()
              }
              className="rounded border border-green px-3 py-1 text-xs font-medium text-green transition-colors hover:bg-green/10 disabled:opacity-50"
            >
              {savingMemo ? "保存中..." : "メモを保存"}
            </button>
          </div>
          <textarea
            value={streamingMemoText || memoDraft}
            onChange={(event) => updateMemoDraft(event.target.value)}
            disabled={isStreaming}
            rows={24}
            placeholder="キーワードを入力してWeb検索し、リサーチメモを生成してください。"
            className="w-full rounded border border-beige bg-off-white px-3 py-2 text-sm text-text-primary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
          {memoNotice && (
            <p className="mt-2 text-xs text-text-secondary">{memoNotice}</p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-600">
              リサーチメモの更新中にエラーが発生しました
            </p>
          )}
        </div>

        <div className="rounded-lg border border-beige bg-white p-4">
          <h3 className="text-sm font-bold text-navy">リサーチメモへのチャット指示</h3>
          <p className="mt-1 text-xs text-text-secondary">
            例: 「数値出典を優先して不足している競合比較を追記してください」
          </p>

          <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded border border-beige bg-off-white p-2">
            {chatHistory.length === 0 ? (
              <p className="text-xs text-text-secondary">
                まだ指示履歴はありません
              </p>
            ) : (
              chatHistory.map((item, index) => (
                <div
                  key={`${item.created_at}-${index}`}
                  className={`rounded px-2 py-1.5 text-xs ${
                    item.role === "user"
                      ? "bg-white text-text-primary"
                      : "bg-green/10 text-green"
                  }`}
                >
                  <p className="mb-1 font-medium">
                    {item.role === "user" ? "あなた" : "AI"}
                  </p>
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>
              ))
            )}
            {isStreaming && activeRequestMode === "chat" && (
              <p className="text-xs text-text-secondary">更新中...</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <textarea
            value={chatInstruction}
            onChange={(event) => updateChatInstruction(event.target.value)}
            rows={3}
            placeholder="追加で調べるべき点や、メモに反映したい修正を入力"
            className="mt-3 w-full rounded border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
          <button
            onClick={sendChatInstruction}
            disabled={
              isStreaming ||
              runningAutonomous ||
              !!activeRequestMode ||
              !chatInstruction.trim() ||
              !briefMarkdown.trim()
            }
            className="mt-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
          >
            {isStreaming || activeRequestMode
              ? "指示を処理中..."
              : "チャット指示を送って更新"}
          </button>
        </div>
      </div>
    </div>
  );
}
