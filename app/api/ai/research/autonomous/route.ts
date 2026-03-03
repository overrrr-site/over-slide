import { generateObject, generateText } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { sonnet } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import {
  RESEARCH_MEMO_PROMPT,
  RESEARCH_QUERY_PROMPT,
} from "@/lib/ai/prompts/research";
import { extractAllUnresolved } from "@/lib/research/pending-issues";
import {
  dedupeSearchResults,
  extractQueriesFromKeywords,
  mergeKeywordText,
  mergeSearchResults,
  sanitizeText,
  truncateForPrompt,
} from "@/lib/research/text-utils";
import { normalizeKeywordTextToQueries } from "@/lib/research/topic-queries";
import {
  buildResearchPromptContext,
  type PromptContextLimits,
  type PromptFileTextInput,
  type PromptSearchResultInput,
} from "@/lib/research/prompt-context";
import { fetchResearchKnowledgeContext } from "@/lib/research/knowledge-context";

const TAVILY_API_URL = "https://api.tavily.com/search";

const requestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  briefSheet: z.string().optional(),
  existingMemo: z.string().optional(),
  keywords: z.string().optional(),
  searchResults: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .optional(),
  fileTexts: z
    .array(
      z.object({
        name: z.string().optional(),
        text: z.string().optional(),
      })
    )
    .optional(),
  maxIterations: z.number().int().min(1).max(3).optional(),
});

const querySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      purpose: z.string(),
    })
  ),
});

const AUTONOMOUS_CONTEXT_LIMITS: PromptContextLimits = {
  maxTotalChars: 36_000,
  briefSheetChars: 12_000,
  memoChars: 14_000,
  instructionChars: 1_200,
  keywordsChars: 1_500,
  maxSearchItems: 12,
  maxSearchSectionChars: 14_000,
  maxSearchContentCharsPerItem: 1_600,
  maxFileItems: 4,
  maxFileSectionChars: 14_000,
  maxFileTextCharsPerItem: 3_000,
} as const;

async function searchByTavily(
  query: string,
  maxResults = 2
): Promise<PromptSearchResultInput[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data?.results)) return [];

  return data.results
    .map((item: Record<string, unknown>) => ({
      title: sanitizeText(item.title) || "無題",
      url: sanitizeText(item.url),
      content: sanitizeText(item.content),
    }))
    .filter(
      (item: PromptSearchResultInput) => item.title || item.url || item.content
    );
}

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) return auth;
      const { supabase, user, profile } = auth;

      const payload = await parseJsonWithSchema(request, requestSchema);
      const maxIterations = Math.min(Math.max(payload.maxIterations ?? 3, 1), 3);

      const { data: existingMemoRecord } = await supabase
        .from("research_memos")
        .select("raw_markdown, theme_keywords, search_results, content")
        .eq("project_id", payload.projectId)
        .single();

      let memoText =
        sanitizeText(payload.existingMemo) ||
        sanitizeText(existingMemoRecord?.raw_markdown);

      let keywordsText =
        normalizeKeywordTextToQueries(sanitizeText(payload.keywords)) ||
        normalizeKeywordTextToQueries(sanitizeText(existingMemoRecord?.theme_keywords));

      let searchResults = dedupeSearchResults([
        ...((payload.searchResults || []) as PromptSearchResultInput[]),
        ...(((existingMemoRecord?.search_results as PromptSearchResultInput[]) ||
          []) as PromptSearchResultInput[]),
      ]);

      const fileTexts = (payload.fileTexts || []) as PromptFileTextInput[];
      const briefSheetText = sanitizeText(payload.briefSheet);

      const iterationLogs: Array<{
        iteration: number;
        unresolvedIssues: string[];
        addedQueries: string[];
        addedSources: number;
      }> = [];

      let remainingIssues: string[] = [];
      let stopReason: "resolved" | "max_iterations" = "max_iterations";

      for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const iterationInstruction =
          iteration === 1
            ? [
                "追加で検討すべき論点が残る場合は、必ず箇条書きで明示してください。",
                "メモ本文中の【根拠不足】項目についても、Web検索で情報が見つかる可能性があれば積極的に調査してください。",
                "Web検索で解消できた【根拠不足】マーカーは削除し、見つかった情報に差し替えてください。",
              ].join("\n")
            : [
                "未解決論点と【根拠不足】項目を優先して解消してください。",
                "Web検索で解消できた【根拠不足】マーカーは削除してください。",
                "解消できなかった論点のみを『追加で検討すべき論点』に残してください。",
              ].join("\n");

        const knowledge = await fetchResearchKnowledgeContext({
          teamId: profile.team_id,
          briefSheet: briefSheetText,
          keywords: keywordsText,
          instruction: iterationInstruction,
          memo: memoText,
          unresolvedIssues: remainingIssues,
        });

        const { context: promptContext } = buildResearchPromptContext({
          briefSheet: briefSheetText,
          memo: memoText,
          instruction: iterationInstruction,
          keywords: keywordsText,
          searchResults,
          fileTexts,
          limits: AUTONOMOUS_CONTEXT_LIMITS,
        });
        const promptContextWithKnowledge = knowledge.context
          ? `${promptContext}\n\n${knowledge.context}`
          : promptContext;

        const { text, usage } = await generateText({
          model: sonnet,
          system: RESEARCH_MEMO_PROMPT,
          prompt: `以下の情報をもとにリサーチメモを更新してください。\n\n${promptContextWithKnowledge}`,
          maxOutputTokens: 4096,
        });

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/research/autonomous",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          projectId: payload.projectId,
          promptChars: promptContextWithKnowledge.length,
          completionChars: text.length,
          usage,
          metadata: { stage: "memo", iteration, kb_chunks: knowledge.chunkCount },
        });

        memoText = text.trim();

        const { pendingIssues: parsedIssues, webSearchableGaps, totalCount } =
          extractAllUnresolved(memoText);
        remainingIssues = parsedIssues;

        if (totalCount === 0) {
          stopReason = "resolved";
          iterationLogs.push({
            iteration,
            unresolvedIssues: [],
            addedQueries: [],
            addedSources: 0,
          });
          break;
        }

        // 未解決論点 + Web検索で解消できそうな【根拠不足】項目を合算
        const allSearchTargets = [
          ...remainingIssues,
          ...webSearchableGaps.map((g) => g.context),
        ];

        const queryPrompt = [
          "未解決論点を追加調査するための検索クエリを作成してください。",
          `## 未解決論点\n${allSearchTargets.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}`,
          briefSheetText ? `## ブリーフシート\n${truncateForPrompt(briefSheetText, 5_000)}` : "",
          keywordsText ? `## 既存キーワード\n${keywordsText}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const { object: queryObject, usage: queryUsage } = await generateObject({
          model: sonnet,
          schema: querySchema,
          system: RESEARCH_QUERY_PROMPT,
          prompt: queryPrompt,
          maxOutputTokens: 2048,
        });

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/research/autonomous",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          projectId: payload.projectId,
          promptChars: queryPrompt.length,
          completionChars: JSON.stringify(queryObject).length,
          usage: queryUsage,
          metadata: { stage: "query", iteration },
        });

        const queryCandidates = queryObject.queries
          .map((item) => sanitizeText(item.query))
          .filter(Boolean);

        const existingQuerySet = new Set(extractQueriesFromKeywords(keywordsText));
        const addedQueries = queryCandidates
          .filter((query) => !existingQuerySet.has(query))
          .slice(0, 5);

        if (addedQueries.length > 0) {
          keywordsText = mergeKeywordText(keywordsText, addedQueries);
        }

        const fetched = await Promise.allSettled(
          addedQueries.map((query) => searchByTavily(query, 2))
        );

        const incomingResults: PromptSearchResultInput[] = [];
        for (const result of fetched) {
          if (result.status === "fulfilled") {
            incomingResults.push(...result.value);
          }
        }

        searchResults = mergeSearchResults(searchResults, incomingResults);

        iterationLogs.push({
          iteration,
          unresolvedIssues: remainingIssues,
          addedQueries,
          addedSources: incomingResults.length,
        });
      }

      const existingContent =
        existingMemoRecord?.content && typeof existingMemoRecord.content === "object"
          ? (existingMemoRecord.content as Record<string, unknown>)
          : {};
      const normalizedKeywordsText = normalizeKeywordTextToQueries(keywordsText);

      const autonomousRunLog = {
        ran_at: new Date().toISOString(),
        stop_reason: stopReason,
        iterations: iterationLogs,
        remaining_issues: remainingIssues,
      };

      await supabase.from("research_memos").upsert(
        {
          project_id: payload.projectId,
          theme_keywords: normalizedKeywordsText,
          search_queries: extractQueriesFromKeywords(normalizedKeywordsText),
          search_results: dedupeSearchResults(searchResults).slice(0, 40),
          raw_markdown: memoText,
          content: {
            ...existingContent,
            autonomous_run_log: autonomousRunLog,
          },
        },
        { onConflict: "project_id" }
      );

      return NextResponse.json({
        finalMemo: memoText,
        keywords: normalizedKeywordsText,
        searchResults: dedupeSearchResults(searchResults).slice(0, 40),
        remainingIssues,
        iterations: iterationLogs,
        stopReason,
      });
    },
    {
      context: "research-autonomous",
      fallbackMessage: "自走リサーチの実行に失敗しました",
    }
  );
}
