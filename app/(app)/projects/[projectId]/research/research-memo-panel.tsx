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

        <p className="text-xs text-text-secondary">
          メモへの修正指示は、右側のAI編集チャットで依頼できます。
        </p>
      </div>
    </div>
  );
}
