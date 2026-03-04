"use client";

import { useEffect, useRef, useMemo } from "react";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import type { ChatMessage } from "./use-project-chat";
import { useProjectChat } from "./use-project-chat";
import { ChatOptionCards } from "./chat-option-cards";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStep: number;
}

function StepSeparator({ step }: { step: number }) {
  const stepInfo = WORKFLOW_STEPS.find((s) => s.id === step);
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 border-t border-beige" />
      <span className="text-xs text-text-secondary">
        {stepInfo?.name || `Step ${step}`}
      </span>
      <div className="flex-1 border-t border-beige" />
    </div>
  );
}

/**
 * Lightweight markdown renderer for chat messages.
 * Supports: **bold**, ## headings, - list items, line breaks.
 */
function ChatMarkdown({ text, isUser }: { text: string; isUser: boolean }) {
  const rendered = useMemo(() => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listKey = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${listKey++}`} className="my-1 ml-4 list-disc space-y-0.5">
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    const inlineParse = (line: string, lineIdx: number): React.ReactNode => {
      // Split by **bold** markers
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      if (parts.length === 1) return line;
      return (
        <span key={`ln-${lineIdx}`}>
          {parts.map((part, i) => {
            const boldMatch = part.match(/^\*\*(.+)\*\*$/);
            if (boldMatch) {
              return (
                <strong key={i} className="font-semibold">
                  {boldMatch[1]}
                </strong>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Heading: ## or ### etc.
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const content = inlineParse(headingMatch[2], i);
        const cls =
          level <= 2
            ? `font-semibold text-sm mt-2 mb-1 ${isUser ? "text-white" : "text-navy"}`
            : `font-semibold text-xs mt-1.5 mb-0.5 ${isUser ? "text-white/90" : "text-text-primary"}`;
        elements.push(
          <div key={`h-${i}`} className={cls}>
            {content}
          </div>
        );
        continue;
      }

      // List item: - text or * text
      const listMatch = line.match(/^[-*]\s+(.+)$/);
      if (listMatch) {
        listItems.push(
          <li key={`li-${i}`}>{inlineParse(listMatch[1], i)}</li>
        );
        continue;
      }

      // Normal line
      flushList();
      if (line.trim() === "") {
        elements.push(<div key={`br-${i}`} className="h-1" />);
      } else {
        elements.push(
          <div key={`p-${i}`}>{inlineParse(line, i)}</div>
        );
      }
    }
    flushList();
    return elements;
  }, [text, isUser]);

  return <div className="break-words">{rendered}</div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { selectOption } = useProjectChat();
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-navy text-white"
            : "border border-beige bg-white text-text-primary"
        }`}
      >
        <ChatMarkdown text={message.content} isUser={isUser} />
        {message.options && message.options.length > 0 && (
          <ChatOptionCards
            messageId={message.id}
            options={message.options}
            selected={!!message.optionsSelected}
            onSelect={selectOption}
          />
        )}
      </div>
    </div>
  );
}

/** Step-specific empty state hints */
function EmptyStateHints({ step }: { step: number }) {
  const hints: Record<number, { title: string; examples: string[] }> = {
    1: {
      title: "リサーチメモの編集をお手伝いします",
      examples: [
        "「競合比較のセクションを追記して」",
        "「数値データの出典を補強して」",
        "「次の工程に向けて足りない情報は？」",
      ],
    },
    2: {
      title: "ページ構成の修正をお手伝いします",
      examples: [
        "「3ページ目をもっとインパクトある内容に」",
        "「全体の流れを見直して」",
        "「ページを1枚追加したい」",
      ],
    },
    3: {
      title: "各ページの詳細を一緒にブラッシュアップ",
      examples: [
        "「4ページ目の表現をもっと具体的に」",
        "「KPIの数値を目立たせたい」",
        "「全体のトーンを統一して」",
      ],
    },
    4: {
      title: "レビュー結果について相談できます",
      examples: [
        "「この指摘はどう改善すべき？」",
        "「優先的に直すべき箇所は？」",
        "「修正の方向性を相談したい」",
      ],
    },
    5: {
      title: "スライドデザインの修正をお手伝いします",
      examples: [
        "「2枚目のレイアウトをすっきりさせて」",
        "「タイトルのフォントを大きく」",
        "「全体の配色を落ち着いたトーンに」",
      ],
    },
    6: {
      title: "デザインレビューについて相談できます",
      examples: [
        "「この指摘のデザイン改善案は？」",
        "「フォントの統一性を確認したい」",
        "「修正の優先順位を教えて」",
      ],
    },
  };

  const hint = hints[step] || {
    title: "資料作成をお手伝いします",
    examples: ["「ここを修正して」", "「方向性を相談したい」"],
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="max-w-[240px] text-center">
        <p className="text-sm font-medium text-text-secondary">
          {hint.title}
        </p>
        <div className="mt-3 space-y-1.5">
          {hint.examples.map((ex, i) => (
            <p
              key={i}
              className="rounded-md bg-white/60 border border-beige/50 px-2.5 py-1.5 text-xs text-text-secondary/80"
            >
              {ex}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatMessageList({ messages, isStreaming, currentStep }: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  if (messages.length === 0) {
    return <EmptyStateHints step={currentStep} />;
  }

  // Group messages and insert step separators
  let lastStep = 0;
  const elements: React.ReactNode[] = [];

  for (const msg of messages) {
    if (msg.step !== lastStep) {
      elements.push(<StepSeparator key={`sep-${msg.step}`} step={msg.step} />);
      lastStep = msg.step;
    }
    elements.push(<MessageBubble key={msg.id} message={msg} />);
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="space-y-3">
        {elements}
        {isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1].role !== "assistant" && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-beige bg-white px-3 py-2 text-sm text-text-secondary">
                <span className="animate-pulse">考え中...</span>
              </div>
            </div>
          )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
