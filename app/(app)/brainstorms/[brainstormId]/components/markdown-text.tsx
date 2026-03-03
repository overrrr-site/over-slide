"use client";

import { useMemo } from "react";

/**
 * 軽量マークダウン変換コンポーネント。
 * AIの返答に含まれる ### 見出し、**太字**、- 箇条書き を
 * 適切なHTMLに変換して表示する。
 */
export function MarkdownText({ text }: { text: string }) {
  const elements = useMemo(() => parseMarkdown(text), [text]);
  return <div className="space-y-1.5">{elements}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    result.push(
      <ul key={key++} className="list-inside list-disc space-y-0.5 pl-1">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      flushList();
      continue;
    }

    // ### 見出し (h3)
    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      flushList();
      result.push(
        <p key={key++} className="font-bold text-text-primary">
          {renderInline(h3Match[1])}
        </p>
      );
      continue;
    }

    // ## 見出し (h2)
    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match) {
      flushList();
      result.push(
        <p key={key++} className="font-bold text-text-primary">
          {renderInline(h2Match[1])}
        </p>
      );
      continue;
    }

    // - / * 箇条書き
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }

    // 番号付きリスト (1. 2. など)
    const numListMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numListMatch) {
      listItems.push(numListMatch[1]);
      continue;
    }

    // 通常段落
    flushList();
    result.push(
      <p key={key++}>{renderInline(trimmed)}</p>
    );
  }

  flushList();
  return result;
}

/** **太字** を <strong> に変換する */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (!boldMatch || boldMatch.index === undefined) {
      parts.push(remaining);
      break;
    }

    // マッチ前のテキスト
    if (boldMatch.index > 0) {
      parts.push(remaining.slice(0, boldMatch.index));
    }
    // 太字部分
    parts.push(
      <strong key={key++} className="font-semibold">
        {boldMatch[1]}
      </strong>
    );
    remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
