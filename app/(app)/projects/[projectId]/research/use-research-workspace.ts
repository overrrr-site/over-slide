"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildBriefSheetMarkdown,
  EMPTY_BRIEF_FIELDS,
  normalizeBriefFields,
  type BriefSheetFields,
} from "@/lib/brief-sheet/format";
import {
  extractQueriesFromKeywords,
  mergeKeywordText,
  mergeSearchResults,
  normalizeSearchResults,
} from "@/lib/research/text-utils";
import {
  normalizeKeywordTextToQueries,
  parseResearchTopicsToQueries,
  type TopicQuerySuggestion,
} from "@/lib/research/topic-queries";
import type {
  ActiveRequestMode,
  AutonomousIteration,
  AutonomousSummary,
  MemoChatMessage,
  SearchResult,
} from "./research-types";

export function useResearchWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [briefFields, setBriefFields] = useState<BriefSheetFields>(EMPTY_BRIEF_FIELDS);
  const [savingBrief, setSavingBrief] = useState(false);
  const [briefNotice, setBriefNotice] = useState<string | null>(null);

  const [keywords, setKeywords] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [memoDraft, setMemoDraft] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoNotice, setMemoNotice] = useState<string | null>(null);
  const [autonomousSummary, setAutonomousSummary] = useState<AutonomousSummary | null>(
    null
  );
  const [runningAutonomous, setRunningAutonomous] = useState(false);
  const [chatInstruction, setChatInstruction] = useState("");
  const [chatHistory, setChatHistory] = useState<MemoChatMessage[]>([]);
  const [activeRequestMode, setActiveRequestMode] = useState<ActiveRequestMode>(null);
  const [inFlightChatHistory, setInFlightChatHistory] = useState<MemoChatMessage[] | null>(
    null
  );
  const [inFlightInstruction, setInFlightInstruction] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevStreamingRef = useRef(false);

  const [aiSuggestions, setAiSuggestions] = useState<TopicQuerySuggestion[]>([]);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/research",
        body: { projectId },
      }),
    [projectId]
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({ transport });
  const briefMarkdown = useMemo(
    () => buildBriefSheetMarkdown(briefFields),
    [briefFields]
  );
  const topicSuggestions = useMemo(
    () => parseResearchTopicsToQueries(briefFields.research_topics),
    [briefFields.research_topics]
  );
  const addedQueries = useMemo(() => {
    return new Set(extractQueriesFromKeywords(keywords));
  }, [keywords]);
  const queryList = useMemo(() => extractQueriesFromKeywords(keywords), [keywords]);
  const streamingMemoText = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return "";

    return lastAssistant.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("")
      .trim();
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  const appendQueriesToKeywords = useCallback((queries: string[]) => {
    if (!queries.length) return;
    setKeywords((prev) => mergeKeywordText(prev, queries));
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [briefResult, memoResult] = await Promise.all([
        supabase
          .from("brief_sheets")
          .select(
            "client_info, background, hypothesis, goal, constraints, research_topics, structure_draft"
          )
          .eq("project_id", projectId)
          .single(),
        supabase
          .from("research_memos")
          .select("raw_markdown, theme_keywords, search_results, content")
          .eq("project_id", projectId)
          .single(),
      ]);

      let loadedKeywords = "";
      let normalizedStoredKeywords = "";
      let hadStoredKeywords = false;
      if (typeof memoResult.data?.theme_keywords === "string") {
        hadStoredKeywords = true;
        normalizedStoredKeywords = normalizeKeywordTextToQueries(
          memoResult.data.theme_keywords
        );
        loadedKeywords = normalizedStoredKeywords;
      }

      if (briefResult.data) {
        const normalized = normalizeBriefFields(briefResult.data);
        setBriefFields(normalized);
        loadedKeywords = mergeKeywordText(
          loadedKeywords,
          parseResearchTopicsToQueries(normalized.research_topics).map(
            (item) => item.query
          )
        );
      }

      if (memoResult.data?.raw_markdown) {
        setMemoDraft(memoResult.data.raw_markdown);
      }
      setKeywords(loadedKeywords);
      setSearchResults(normalizeSearchResults(memoResult.data?.search_results));

      if (
        hadStoredKeywords &&
        typeof memoResult.data?.theme_keywords === "string" &&
        normalizedStoredKeywords !== memoResult.data.theme_keywords.trim()
      ) {
        await supabase
          .from("research_memos")
          .update({
            theme_keywords: normalizedStoredKeywords,
            search_queries: extractQueriesFromKeywords(normalizedStoredKeywords),
          })
          .eq("project_id", projectId);
      }

      const storedHistory = (memoResult.data?.content as { chat_history?: unknown[] } | null)
        ?.chat_history;
      if (Array.isArray(storedHistory)) {
        const normalizedHistory = storedHistory
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const item = row as Partial<MemoChatMessage>;
            if (
              (item.role !== "user" && item.role !== "assistant") ||
              typeof item.text !== "string"
            ) {
              return null;
            }
            return {
              role: item.role,
              text: item.text,
              created_at:
                typeof item.created_at === "string"
                  ? item.created_at
                  : new Date().toISOString(),
            } as MemoChatMessage;
          })
          .filter((item): item is MemoChatMessage => item !== null);
        setChatHistory(normalizedHistory);
      }
    };
    void load();
  }, [projectId]);

  const updateBriefField = useCallback((field: keyof BriefSheetFields, value: string) => {
    setBriefNotice(null);
    setBriefFields((prev) => ({ ...prev, [field]: value }));
  }, []);

  const saveBriefSheet = useCallback(async () => {
    setSavingBrief(true);
    setBriefNotice(null);

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("brief_sheets")
      .upsert(
        {
          project_id: projectId,
          ...briefFields,
          raw_markdown: briefMarkdown,
        },
        { onConflict: "project_id" }
      );

    if (saveError) {
      setBriefNotice("ブリーフシートの保存に失敗しました");
    } else {
      appendQueriesToKeywords(
        parseResearchTopicsToQueries(briefFields.research_topics).map(
          (item) => item.query
        )
      );
      setBriefNotice("ブリーフシートを保存しました");
    }

    setSavingBrief(false);
  }, [appendQueriesToKeywords, briefFields, briefMarkdown, projectId]);

  const handleSuggestKeywords = useCallback(async () => {
    setSuggestingKeywords(true);
    setMemoNotice(null);
    try {
      const res = await fetch("/api/ai/suggest-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          briefSheet: briefMarkdown,
          researchTopics: briefFields.research_topics,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.queries)) {
          const suggestions: TopicQuerySuggestion[] = data.queries
            .map((item: unknown) => {
              if (!item || typeof item !== "object") return null;
              const row = item as Partial<TopicQuerySuggestion>;
              if (typeof row.query !== "string" || !row.query.trim()) return null;
              return {
                query: row.query.trim(),
                purpose: typeof row.purpose === "string" ? row.purpose : "",
                source: typeof row.source === "string" ? row.source : undefined,
              } satisfies TopicQuerySuggestion;
            })
            .filter(
              (item: TopicQuerySuggestion | null): item is TopicQuerySuggestion =>
                item !== null
            );

          setAiSuggestions(suggestions);
          appendQueriesToKeywords(suggestions.map((item) => item.query));
        }
      }
    } catch {
      // エラー時は何もしない
    }
    setSuggestingKeywords(false);
  }, [appendQueriesToKeywords, briefFields.research_topics, briefMarkdown, projectId]);

  const handleSearch = useCallback(async () => {
    const queries = queryList.slice(0, 10);
    if (!queries.length) return;
    setSearching(true);
    setMemoNotice(null);

    const fetched = await Promise.allSettled(
      queries.map(async (query) => {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, maxResults: 3 }),
        });
        if (!res.ok) return [];

        const data = await res.json();
        if (!Array.isArray(data.results)) return [];
        return data.results
          .map((row: SearchResult) => ({
            title: row.title || "無題",
            url: row.url || "",
            content: row.content || "",
          }))
          .filter((row: SearchResult) => row.title || row.url || row.content);
      })
    );

    const incoming: SearchResult[] = [];
    for (const result of fetched) {
      if (result.status === "fulfilled") {
        incoming.push(...result.value);
      }
    }

    setSearchResults((prev) => mergeSearchResults(prev, incoming));
    setSearching(false);
  }, [queryList]);

  const runAutonomousResearch = useCallback(async () => {
    if (runningAutonomous || isStreaming || activeRequestMode) return;

    setRunningAutonomous(true);
    setMemoNotice(null);
    setAutonomousSummary(null);

    try {
      const response = await fetch("/api/ai/research/autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          briefSheet: briefMarkdown,
          existingMemo: (streamingMemoText || memoDraft).trim(),
          keywords,
          searchResults,
          maxIterations: 3,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "自走リサーチの実行に失敗しました");
      }

      if (typeof data.finalMemo === "string") {
        setMemoDraft(data.finalMemo);
      }

      if (typeof data.keywords === "string") {
        setKeywords(data.keywords);
      }

      if (Array.isArray(data.searchResults)) {
        setSearchResults(normalizeSearchResults(data.searchResults));
      }

      const summary: AutonomousSummary = {
        stopReason:
          data.stopReason === "resolved" ? "resolved" : "max_iterations",
        remainingIssues: Array.isArray(data.remainingIssues)
          ? data.remainingIssues.filter((item: unknown): item is string => typeof item === "string")
          : [],
        iterations: Array.isArray(data.iterations)
          ? data.iterations
              .map((item: unknown) => {
                if (!item || typeof item !== "object") return null;
                const row = item as Partial<AutonomousIteration>;
                return {
                  iteration:
                    typeof row.iteration === "number" ? row.iteration : 0,
                  unresolvedIssues: Array.isArray(row.unresolvedIssues)
                    ? row.unresolvedIssues.filter((v): v is string => typeof v === "string")
                    : [],
                  addedQueries: Array.isArray(row.addedQueries)
                    ? row.addedQueries.filter((v): v is string => typeof v === "string")
                    : [],
                  addedSources:
                    typeof row.addedSources === "number" ? row.addedSources : 0,
                } as AutonomousIteration;
              })
              .filter(
                (item: AutonomousIteration | null): item is AutonomousIteration =>
                  item !== null
              )
          : [],
      };

      setAutonomousSummary(summary);

      if (summary.stopReason === "resolved") {
        setMemoNotice("自走リサーチが完了しました（未解決論点なし）");
      } else {
        setMemoNotice("自走リサーチは上限（3周）で停止しました");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "自走リサーチの実行に失敗しました";
      setMemoNotice(message);
    } finally {
      setRunningAutonomous(false);
    }
  }, [
    activeRequestMode,
    briefMarkdown,
    isStreaming,
    keywords,
    memoDraft,
    projectId,
    runningAutonomous,
    searchResults,
    streamingMemoText,
  ]);

  const persistResearchMemo = useCallback(
    async (
      markdown: string,
      history: MemoChatMessage[],
      latestInstruction: string = ""
    ): Promise<boolean> => {
      const normalizedKeywords = normalizeKeywordTextToQueries(keywords);
      const supabase = createClient();
      const { error: saveError } = await supabase.from("research_memos").upsert(
        {
          project_id: projectId,
          theme_keywords: normalizedKeywords,
          search_queries: extractQueriesFromKeywords(normalizedKeywords),
          search_results: searchResults,
          raw_markdown: markdown,
          content: {
            chat_history: history,
            latest_instruction: latestInstruction,
          },
        },
        { onConflict: "project_id" }
      );

      return !saveError;
    },
    [projectId, keywords, searchResults]
  );

  const saveMemo = useCallback(async (): Promise<boolean> => {
    const currentMemo = (streamingMemoText || memoDraft).trim();
    if (!currentMemo) return false;

    setSavingMemo(true);
    setMemoNotice(null);
    const saved = await persistResearchMemo(currentMemo, chatHistory);
    if (saved) {
      setMemoDraft(currentMemo);
      setMemoNotice("リサーチメモを保存しました");
    } else {
      setMemoNotice("リサーチメモの保存に失敗しました");
    }
    setSavingMemo(false);

    return saved;
  }, [chatHistory, memoDraft, persistResearchMemo, streamingMemoText]);

  const requestMemoUpdate = useCallback(
    (instruction: string, nextHistory: MemoChatMessage[]) => {
      setMemoNotice(null);
      setMessages([]);
      setInFlightChatHistory(nextHistory);
      setInFlightInstruction(instruction);
      setActiveRequestMode(instruction ? "chat" : "generate");

      sendMessage({
        text: JSON.stringify({
          briefSheet: briefMarkdown,
          searchResults,
          keywords,
          existingMemo: memoDraft,
          instruction,
          chatHistory: nextHistory,
        }),
      });
    },
    [briefMarkdown, keywords, memoDraft, searchResults, sendMessage, setMessages]
  );

  const generateMemo = useCallback(() => {
    requestMemoUpdate("", chatHistory);
  }, [chatHistory, requestMemoUpdate]);

  const sendChatInstruction = useCallback(() => {
    const instruction = chatInstruction.trim();
    if (!instruction || isStreaming || activeRequestMode) return;

    const nextHistory: MemoChatMessage[] = [
      ...chatHistory,
      {
        role: "user",
        text: instruction,
        created_at: new Date().toISOString(),
      },
    ];

    setChatHistory(nextHistory);
    setChatInstruction("");
    requestMemoUpdate(instruction, nextHistory);
  }, [
    activeRequestMode,
    chatHistory,
    chatInstruction,
    isStreaming,
    requestMemoUpdate,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      prevStreamingRef.current = true;
      return;
    }

    if (!prevStreamingRef.current || !activeRequestMode) return;
    prevStreamingRef.current = false;

    const finalize = async () => {
      const generatedMemo = streamingMemoText.trim();
      if (!generatedMemo) {
        setMemoNotice("AIの応答を取得できませんでした。再度お試しください。");
        setActiveRequestMode(null);
        setInFlightChatHistory(null);
        setInFlightInstruction("");
        return;
      }

      let nextHistory = inFlightChatHistory ?? chatHistory;
      if (activeRequestMode === "chat") {
        nextHistory = [
          ...nextHistory,
          {
            role: "assistant",
            text: "指示を反映してリサーチメモを更新しました。",
            created_at: new Date().toISOString(),
          },
        ];
        setChatHistory(nextHistory);
      }

      const saved = await persistResearchMemo(
        generatedMemo,
        nextHistory,
        inFlightInstruction
      );
      setMemoNotice(
        saved
          ? "リサーチメモを更新しました"
          : "更新メモの保存に失敗しました"
      );
      setMemoDraft(generatedMemo);
      setActiveRequestMode(null);
      setInFlightChatHistory(null);
      setInFlightInstruction("");
      setMessages([]);
    };

    void finalize();
  }, [
    activeRequestMode,
    chatHistory,
    inFlightChatHistory,
    inFlightInstruction,
    isStreaming,
    memoDraft,
    persistResearchMemo,
    setMessages,
    streamingMemoText,
  ]);

  const completeResearch = useCallback(async () => {
    const currentMemo = (streamingMemoText || memoDraft).trim();
    if (currentMemo) {
      const saved = await saveMemo();
      if (!saved) return;
    }

    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 2 })
      .eq("id", projectId);

    router.push(`/projects/${projectId}/structure`);
  }, [memoDraft, projectId, router, saveMemo, streamingMemoText]);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const clearKeywordsAndSuggestions = useCallback(() => {
    setKeywords("");
    setAiSuggestions([]);
  }, []);

  const updateKeywords = useCallback((value: string) => {
    setKeywords(value);
  }, []);

  const updateMemoDraft = useCallback((value: string) => {
    setMemoDraft(value);
    setMemoNotice(null);
  }, []);

  const updateChatInstruction = useCallback((value: string) => {
    setChatInstruction(value);
  }, []);

  return {
    briefFields,
    savingBrief,
    briefNotice,
    keywords,
    searchResults,
    searching,
    memoDraft,
    savingMemo,
    memoNotice,
    autonomousSummary,
    runningAutonomous,
    chatInstruction,
    chatHistory,
    activeRequestMode,
    messagesEndRef,
    aiSuggestions,
    suggestingKeywords,
    briefMarkdown,
    topicSuggestions,
    addedQueries,
    queryList,
    streamingMemoText,
    isStreaming,
    error,
    updateBriefField,
    saveBriefSheet,
    handleSuggestKeywords,
    updateKeywords,
    handleSearch,
    clearSearchResults,
    clearKeywordsAndSuggestions,
    generateMemo,
    runAutonomousResearch,
    completeResearch,
    saveMemo,
    updateMemoDraft,
    updateChatInstruction,
    sendChatInstruction,
  };
}
