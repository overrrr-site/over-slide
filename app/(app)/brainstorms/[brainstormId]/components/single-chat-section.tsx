"use client";

import { useRef, type FormEvent, type RefObject } from "react";
import { Icon } from "@iconify/react";
import type { SimpleDiscussionMessage } from "../types";
import { MarkdownText } from "./markdown-text";
import { stripMarkers } from "../hooks/use-discussion-mode";

const ACCEPTED_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.bmp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/*";

interface UploadedFileItem {
  id: string;
  file_name: string;
}

interface SingleChatSectionProps {
  messages: SimpleDiscussionMessage[];
  isStreaming: boolean;
  inputValue: string;
  generatingBrief: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  uploadedFiles: UploadedFileItem[];
  uploading: boolean;
  uploadError: string | null;
  uploadWarning: string | null;
  onInputChange: (value: string) => void;
  onSend: (e?: FormEvent) => void;
  onFileUpload: (file: File) => void;
  onFileDelete: (fileId: string) => void;
  onGenerateBriefSheet: () => void;
  onCompleteDiscussion: () => void;
}

export function SingleChatSection({
  messages,
  isStreaming,
  inputValue,
  generatingBrief,
  messagesEndRef,
  uploadedFiles,
  uploading,
  uploadError,
  uploadWarning,
  onInputChange,
  onSend,
  onFileUpload,
  onFileDelete,
  onGenerateBriefSheet,
  onCompleteDiscussion,
}: SingleChatSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* アップ済み資料バッジ */}
      {(uploadedFiles.length > 0 || uploading) && (
        <div className="border-b border-beige bg-off-white/50 px-4 py-2">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
            <span className="text-xs text-text-secondary">与件資料：</span>
            {uploadedFiles.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-full border border-beige bg-white px-2.5 py-0.5 text-xs text-text-primary"
              >
                <Icon icon="mdi:file-document-outline" className="h-3.5 w-3.5 shrink-0" />
                {f.file_name}
                <button
                  onClick={() => onFileDelete(f.id)}
                  className="ml-0.5 text-text-secondary hover:text-red-500"
                  title="削除"
                >
                  <Icon icon="mdi:close" className="h-3 w-3" />
                </button>
              </span>
            ))}
            {uploading && (
              <span className="inline-flex items-center gap-1 rounded-full border border-beige bg-white px-2.5 py-0.5 text-xs text-text-secondary">
                <span className="animate-pulse">アップロード中...</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-text-secondary">
                ブレインストーミングを開始してください。
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                AIが考えを引き出し、ブリーフシートを構造化します。
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message) => {
            const displayText =
              message.role === "assistant"
                ? stripMarkers(message.text)
                : message.text;

            return (
              <div key={message.id}>
                <div
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-navy text-white"
                        : "border border-beige bg-white text-text-primary"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <MarkdownText text={displayText} />
                    ) : (
                      <div className="whitespace-pre-wrap">{displayText}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-beige bg-white px-4 py-3 text-sm text-text-secondary">
                <span className="animate-pulse">考え中...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-beige bg-white p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file);
            e.target.value = "";
          }}
        />
        <form onSubmit={onSend} className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center rounded-md border border-beige bg-off-white px-2.5 text-lg text-text-secondary transition-colors hover:border-green hover:text-green disabled:opacity-50"
            title="資料をアップロード"
          >
            <Icon icon="mdi:paperclip" className="h-5 w-5" />
          </button>
          <input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isStreaming}
            className="flex-1 rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
          >
            送信
          </button>
        </form>

        <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between">
          <button
            onClick={onGenerateBriefSheet}
            disabled={generatingBrief || messages.length < 2}
            className="text-xs text-green hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {generatingBrief
              ? "ブリーフシート生成中..."
              : "ブリーフシートを更新"}
          </button>
          <button
            onClick={onCompleteDiscussion}
            disabled={messages.length < 4}
            className="rounded-md bg-green px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
          >
            ブリーフとして完了
          </button>
        </div>

        {uploadError && (
          <p className="mx-auto mt-2 max-w-2xl text-xs text-red-600">
            {uploadError}
          </p>
        )}
        {uploadWarning && !uploadError && (
          <p className="mx-auto mt-2 max-w-2xl text-xs text-amber-700">
            {uploadWarning}
          </p>
        )}
      </div>
    </>
  );
}
