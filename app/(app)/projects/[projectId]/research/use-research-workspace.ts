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
import { mergeMemoSections } from "@/lib/research/memo-section-merger";
import {
  normalizeKeywordTextToQueries,
  type TopicQuerySuggestion,
} from "@/lib/research/topic-queries";
import {
  parseQueryPresetMeta,
  type QueryPresetSource,
} from "@/lib/research/query-preset";
import type {
  ActiveRequestMode,
  AutonomousIteration,
  AutonomousSummary,
  MemoChatMessage,
  SearchResult,
} from "./research-types";

interface ResearchMemoContent {
  chat_history?: unknown[];
  latest_instruction?: string | null;
  query_preset?: unknown;
  [key: string]: unknown;
}

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
  const briefUpdatedAtRef = useRef<string | null>(null);

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

  // 部分編集モード: チャット指示時はAIが変更セクションだけ返すので、
  // 既存メモとマージした結果を表示に使う
  const mergedStreamingMemo = useMemo(() => {
    if (activeRequestMode !== "chat" || !streamingMemoText || !memoDraft) {
      return "";
    }
    return mergeMemoSections(memoDraft, streamingMemoText);
  }, [activeRequestMode, memoDraft, streamingMemoText]);

  const isStreaming = status === "streaming" || status === "submitted";

  const appendQueriesToKeywords = useCallback((queries: string[]) => {
    if (!queries.length) return;
    setKeywords((prev) => mergeKeywordText(prev, queries));
  }, []);

  const requestKeywordSuggestions = useCallback(
    async (params: {
      source: QueryPresetSource;
      persistPreset: boolean;
      briefSheet: string;
      researchTopics: string;
      existingKeywords: string;
      briefUpdatedAt: string | null;
      showFailureNotice: boolean;
    }) => {
      setSuggestingKeywords(true);
      try {
        const res = await fetch("/api/ai/suggest-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            briefSheet: params.briefSheet,
            researchTopics: params.researchTopics,
            source: params.source,
            persistPreset: params.persistPreset,
            existingKeywords: params.existingKeywords,
            briefUpdatedAt: params.briefUpdatedAt ?? undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "キーワード候補の生成に失敗しました"
          );
        }

        const suggestions: TopicQuerySuggestion[] = Array.isArray(data.queries)
          ? data.queries
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
              )
          : [];

        setAiSuggestions(suggestions);

        if (typeof data.keywords === "string") {
          setKeywords(normalizeKeywordTextToQueries(data.keywords));
        } else {
          appendQueriesToKeywords(suggestions.map((item) => item.query));
        }

        return {
          ok: true as const,
          addedCount:
            typeof data.addedQueryCount === "number" ? data.addedQueryCount : null,
        };
      } catch (error) {
        if (params.showFailureNotice) {
          setBriefNotice(
            "クエリの自動生成に失敗しました。『AIでクエリ再生成』で再試行してください"
          );
        }
        return {
          ok: false as const,
          error:
            error instanceof Error ? error.message : "キーワード候補の生成に失敗しました",
        };
      } finally {
        setSuggestingKeywords(false);
      }
    },
    [appendQueriesToKeywords, projectId]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const supabase = createClient();
      const [briefResult, memoResult] = await Promise.all([
        supabase
          .from("brief_sheets")
          .select(
            "client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, reasoning_chain, rejected_alternatives, key_expressions, discussion_note, raw_markdown, updated_at"
          )
          .eq("project_id", projectId)
          .single(),
        supabase
          .from("research_memos")
          .select("raw_markdown, theme_keywords, search_results, content")
          .eq("project_id", projectId)
          .single(),
      ]);

      if (cancelled) return;

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

      const briefData = briefResult.data ? normalizeBriefFields(briefResult.data) : null;
      const loadedBriefMarkdown =
        typeof briefResult.data?.raw_markdown === "string" &&
        briefResult.data.raw_markdown.trim()
          ? briefResult.data.raw_markdown
          : briefData
            ? buildBriefSheetMarkdown(briefData)
            : "";
      const briefUpdatedAt =
        typeof briefResult.data?.updated_at === "string"
          ? briefResult.data.updated_at
          : null;
      briefUpdatedAtRef.current = briefUpdatedAt;

      if (briefData) {
        setBriefFields(briefData);
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

      const memoContent: ResearchMemoContent =
        memoResult.data?.content && typeof memoResult.data.content === "object"
          ? (memoResult.data.content as ResearchMemoContent)
          : {};
      const queryPreset = parseQueryPresetMeta(memoContent.query_preset);

      const storedHistory = memoContent.chat_history;
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

      const shouldAutoPreset =
        !!loadedBriefMarkdown.trim() &&
        (!loadedKeywords.trim() ||
          !queryPreset ||
          queryPreset.status === "failed" ||
          (briefUpdatedAt &&
            queryPreset.brief_updated_at !== briefUpdatedAt));

      if (shouldAutoPreset) {
        await requestKeywordSuggestions({
          source: "research_init",
          persistPreset: true,
          briefSheet: loadedBriefMarkdown,
          researchTopics: briefData?.research_topics || "",
          existingKeywords: loadedKeywords,
          briefUpdatedAt,
          showFailureNotice: true,
        });
      }

    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, requestKeywordSuggestions]);

  const updateBriefField = useCallback((field: keyof BriefSheetFields, value: string) => {
    setBriefNotice(null);
    setBriefFields((prev) => ({ ...prev, [field]: value }));
  }, []);

  const saveBriefSheet = useCallback(async () => {
    setSavingBrief(true);
    setBriefNotice(null);

    const supabase = createClient();
    const { data: savedBrief, error: saveError } = await supabase
      .from("brief_sheets")
      .upsert(
        {
          project_id: projectId,
          ...briefFields,
          raw_markdown: briefMarkdown,
        },
        { onConflict: "project_id" }
      )
      .select("updated_at")
      .single();

    if (saveError) {
      setBriefNotice("ブリーフシートの保存に失敗しました");
    } else {
      const nextBriefUpdatedAt =
        typeof savedBrief?.updated_at === "string"
          ? savedBrief.updated_at
          : new Date().toISOString();
      briefUpdatedAtRef.current = nextBriefUpdatedAt;

      const result = await requestKeywordSuggestions({
        source: "brief_save",
        persistPreset: true,
        briefSheet: briefMarkdown,
        researchTopics: briefFields.research_topics,
        existingKeywords: keywords,
        briefUpdatedAt: nextBriefUpdatedAt,
        showFailureNotice: false,
      });

      if (result.ok) {
        const added = typeof result.addedCount === "number" ? result.addedCount : 0;
        setBriefNotice(
          added > 0
            ? `ブリーフを保存し、クエリを${added}件追加しました`
            : "ブリーフを保存しました（追加クエリなし）"
        );
      } else {
        setBriefNotice(
          "ブリーフは保存しましたが、クエリ再生成に失敗しました。『AIでクエリ再生成』で再試行してください"
        );
      }
    }

    setSavingBrief(false);
  }, [
    briefFields,
    briefMarkdown,
    keywords,
    projectId,
    requestKeywordSuggestions,
  ]);

  const handleSuggestKeywords = useCallback(async () => {
    setBriefNotice(null);
    setMemoNotice(null);
    const result = await requestKeywordSuggestions({
      source: "manual",
      persistPreset: true,
      briefSheet: briefMarkdown,
      researchTopics: briefFields.research_topics,
      existingKeywords: keywords,
      briefUpdatedAt: briefUpdatedAtRef.current,
      showFailureNotice: true,
    });

    if (result.ok) {
      const added = typeof result.addedCount === "number" ? result.addedCount : 0;
      setBriefNotice(
        added > 0
          ? `AIでクエリを再生成し、${added}件追加しました`
          : "AIでクエリを再生成しました（追加クエリなし）"
      );
    }
  }, [
    briefFields.research_topics,
    briefMarkdown,
    keywords,
    requestKeywordSuggestions,
  ]);

  const handleSearch = useCallback(async () => {
    const queries = queryList.slice(0, 15);
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
      // 最新のメモ・キーワード・検索結果をDBに保存してからAPI呼び出し
      const currentMemo = (streamingMemoText || memoDraft).trim();
      if (currentMemo) {
        const normalizedKw = normalizeKeywordTextToQueries(keywords);
        const supabase = createClient();
        await supabase.from("research_memos").upsert(
          {
            project_id: projectId,
            theme_keywords: normalizedKw,
            search_queries: extractQueriesFromKeywords(normalizedKw),
            search_results: searchResults,
            raw_markdown: currentMemo,
          },
          { onConflict: "project_id" }
        );
      }

      const response = await fetch("/api/ai/research/autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          briefSheet: briefMarkdown,
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
      const { data: existingMemo } = await supabase
        .from("research_memos")
        .select("content")
        .eq("project_id", projectId)
        .single();
      const existingContent =
        existingMemo?.content && typeof existingMemo.content === "object"
          ? (existingMemo.content as Record<string, unknown>)
          : {};

      const { error: saveError } = await supabase.from("research_memos").upsert(
        {
          project_id: projectId,
          theme_keywords: normalizedKeywords,
          search_queries: extractQueriesFromKeywords(normalizedKeywords),
          search_results: searchResults,
          raw_markdown: markdown,
          content: {
            ...existingContent,
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
      const rawOutput = streamingMemoText.trim();
      if (!rawOutput) {
        setMemoNotice("AIの応答を取得できませんでした。再度お試しください。");
        setActiveRequestMode(null);
        setInFlightChatHistory(null);
        setInFlightInstruction("");
        return;
      }

      // 部分編集の場合: AI出力（変更セクションのみ）を既存メモにマージ
      const generatedMemo =
        activeRequestMode === "chat" && memoDraft
          ? mergeMemoSections(memoDraft, rawOutput)
          : rawOutput;

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

  // Exposed for AI assistant APPLY handler
  const applyMemoRevision = useCallback(
    (instruction: string) => {
      if (!instruction.trim() || isStreaming || activeRequestMode) return;
      requestMemoUpdate(instruction, chatHistory);
    },
    [activeRequestMode, chatHistory, isStreaming, requestMemoUpdate]
  );

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
    addedQueries,
    queryList,
    streamingMemoText,
    mergedStreamingMemo,
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
    applyMemoRevision,
  };
}
