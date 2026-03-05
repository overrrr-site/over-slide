"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DiscussionMode,
  CoverageStatus,
  CoverageItemKey,
  DiscussionChatMessage,
} from "../types";
import { getMessageText } from "../utils";

const CURRENT_PHASE_REGEX =
  /\[CURRENT_PHASE:(draw_out|challenge|expand|structure)\]/;
const COVERAGE_REGEX = /\[COVERAGE:([\w,]+)\]/;
const VALID_COVERAGE_KEYS: CoverageItemKey[] = [
  "client_info",
  "background",
  "hypothesis",
  "goal",
  "constraints",
];

const INITIAL_COVERAGE: CoverageStatus = {
  client_info: false,
  background: false,
  hypothesis: false,
  goal: false,
  constraints: false,
};

interface UseDiscussionModeParams {
  messages: DiscussionChatMessage[];
}

export function useDiscussionMode({ messages }: UseDiscussionModeParams) {
  const [currentPhase, setCurrentPhase] =
    useState<DiscussionMode>("draw_out");
  const [coverageStatus, setCoverageStatus] =
    useState<CoverageStatus>(INITIAL_COVERAGE);
  const lastParsedIndexRef = useRef(-1);

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const msgIndex = messages.length - 1;
    if (msgIndex <= lastParsedIndexRef.current) return;
    lastParsedIndexRef.current = msgIndex;

    const text = getMessageText(lastMessage);

    // Parse current phase
    const phaseMatch = text.match(CURRENT_PHASE_REGEX);
    if (phaseMatch) {
      const phase = phaseMatch[1] as DiscussionMode;
      setTimeout(() => setCurrentPhase(phase), 0);
    }

    // Parse coverage (only relevant in draw_out phase)
    const coverageMatch = text.match(COVERAGE_REGEX);
    if (coverageMatch) {
      const items = coverageMatch[1].split(",");
      setTimeout(() => {
        setCoverageStatus((prev) => {
          const next = { ...prev };
          for (const item of items) {
            const key = item.trim() as CoverageItemKey;
            if (VALID_COVERAGE_KEYS.includes(key)) {
              next[key] = true;
            }
          }
          return next;
        });
      }, 0);
    }
  }, [messages]);

  return {
    currentPhase,
    coverageStatus,
  };
}

/**
 * AI応答テキストからマーカーを除去して表示用テキストを返す
 */
export function stripMarkers(text: string): string {
  return text
    .replace(CURRENT_PHASE_REGEX, "")
    .replace(COVERAGE_REGEX, "")
    .trimEnd();
}
