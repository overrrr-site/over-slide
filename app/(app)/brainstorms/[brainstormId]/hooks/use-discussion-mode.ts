"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DiscussionMode,
  CoverageStatus,
  CoverageItemKey,
  DiscussionChatMessage,
} from "../types";
import { getMessageText } from "../utils";

const MODE_SUGGEST_REGEX = /\[MODE_SUGGEST:(draw_out|challenge|expand|structure)\]/;
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
  currentMode: DiscussionMode;
  onModeChange: (mode: DiscussionMode) => void;
}

export function useDiscussionMode({
  messages,
  currentMode,
  onModeChange,
}: UseDiscussionModeParams) {
  const [suggestedMode, setSuggestedMode] = useState<DiscussionMode | null>(
    null
  );
  const [coverageStatus, setCoverageStatus] =
    useState<CoverageStatus>(INITIAL_COVERAGE);
  const lastParsedIndexRef = useRef(-1);

  // Parse AI responses for mode suggestions and coverage markers
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    // Avoid re-parsing the same message
    const msgIndex = messages.length - 1;
    if (msgIndex <= lastParsedIndexRef.current) return;
    lastParsedIndexRef.current = msgIndex;

    const text = getMessageText(lastMessage);

    // Parse mode suggestion
    const modeMatch = text.match(MODE_SUGGEST_REGEX);
    if (modeMatch) {
      const suggested = modeMatch[1] as DiscussionMode;
      if (suggested !== currentMode) {
        setTimeout(() => setSuggestedMode(suggested), 0);
      }
    }

    // Parse coverage (only relevant in draw_out mode)
    if (currentMode === "draw_out") {
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
    }
  }, [messages, currentMode]);

  const acceptSuggestion = useCallback(() => {
    if (suggestedMode) {
      onModeChange(suggestedMode);
      setSuggestedMode(null);
    }
  }, [suggestedMode, onModeChange]);

  const dismissSuggestion = useCallback(() => {
    setSuggestedMode(null);
  }, []);

  return {
    suggestedMode,
    coverageStatus,
    acceptSuggestion,
    dismissSuggestion,
  };
}

/**
 * AI応答テキストからマーカーを除去して表示用テキストを返す
 */
export function stripMarkers(text: string): string {
  return text
    .replace(MODE_SUGGEST_REGEX, "")
    .replace(COVERAGE_REGEX, "")
    .trimEnd();
}
