"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  BriefSheetData,
  BriefSheetTone,
  DiscussionChatMessage,
} from "../types";
import { getMessageText } from "../utils";

type RunWithTimeout = <T>(
  action: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
) => Promise<T>;

interface UseBriefSheetParams {
  brainstormId: string;
  messages: DiscussionChatMessage[];
  isStreaming: boolean;
  runWithTimeout: RunWithTimeout;
}

function normalizeBriefSheetData(
  data: Partial<BriefSheetData> | null | undefined
): BriefSheetData | null {
  if (!data?.raw_markdown) return null;

  return {
    client_info: data.client_info || "",
    background: data.background || "",
    hypothesis: data.hypothesis || "",
    goal: data.goal || "",
    constraints: data.constraints || "",
    research_topics: data.research_topics || "",
    structure_draft: data.structure_draft || "",
    raw_markdown: data.raw_markdown || "",
  };
}

export function useBriefSheet({
  brainstormId,
  messages,
  isStreaming,
  runWithTimeout,
}: UseBriefSheetParams) {
  const [briefSheet, setBriefSheet] = useState<BriefSheetData | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefTone, setBriefTone] = useState<BriefSheetTone>("hybrid");
  const autoGenTriggeredRef = useRef(false);

  useEffect(() => {
    const loadHistory = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("brainstorm_sessions")
        .select(
          "client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown, brief_tone"
        )
        .eq("id", brainstormId)
        .single();

      setBriefSheet(normalizeBriefSheetData(data));
      if (
        data?.brief_tone === "logical" ||
        data?.brief_tone === "emotional" ||
        data?.brief_tone === "hybrid"
      ) {
        setBriefTone(data.brief_tone);
      }
      autoGenTriggeredRef.current = false;
    };

    loadHistory();
  }, [brainstormId]);

  const generateBriefSheet = useCallback(
    async (tone?: BriefSheetTone): Promise<boolean> => {
      if (messages.length < 2) return false;
      setGeneratingBrief(true);
      setBriefError(null);

      const selectedTone = tone || briefTone;

      try {
        const res = await runWithTimeout(
          (signal) =>
            fetch("/api/ai/brief-sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brainstormId,
                chatHistory: messages.map((message) => ({
                  role: message.role,
                  content: getMessageText(message),
                })),
                tone: selectedTone,
              }),
              signal,
            }),
          130_000
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || `生成に失敗しました（ステータス: ${res.status}）`
          );
        }

        const data = (await res.json()) as BriefSheetData;
        setBriefSheet(normalizeBriefSheetData(data));
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setBriefError("生成がタイムアウトしました。もう一度お試しください。");
        } else {
          setBriefError(
            err instanceof Error
              ? err.message
              : "ブリーフシートの生成に失敗しました"
          );
        }
        return false;
      } finally {
        setGeneratingBrief(false);
      }
    },
    [messages, brainstormId, runWithTimeout, briefTone]
  );

  useEffect(() => {
    if (
      briefSheet ||
      generatingBrief ||
      isStreaming ||
      messages.length < 6 ||
      autoGenTriggeredRef.current
    ) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") {
      return;
    }

    const timer = setTimeout(() => {
      autoGenTriggeredRef.current = true;
      generateBriefSheet();
    }, 2000);

    return () => clearTimeout(timer);
  }, [messages, briefSheet, generatingBrief, isStreaming, generateBriefSheet]);

  return {
    briefSheet,
    setBriefSheet,
    generatingBrief,
    briefError,
    briefTone,
    setBriefTone,
    generateBriefSheet,
  };
}
