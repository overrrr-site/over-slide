import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { sonnet } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import {
  RESEARCH_MEMO_PROMPT,
  RESEARCH_MEMO_EDIT_PROMPT,
} from "@/lib/ai/prompts/research";
import { mergeMemoSections } from "@/lib/research/memo-section-merger";
import {
  dedupeSearchResults,
  extractQueriesFromKeywords,
  sanitizeText,
} from "@/lib/research/text-utils";
import { normalizeKeywordTextToQueries } from "@/lib/research/topic-queries";
import { fetchResearchKnowledgeContext } from "@/lib/research/knowledge-context";
import {
  buildResearchPromptContext,
  type PromptContextLimits,
  type PromptFileTextInput,
  type PromptSearchResultInput,
} from "@/lib/research/prompt-context";

interface MemoChatInput {
  role?: string;
  text?: string;
  created_at?: string;
}

const RESEARCH_CONTEXT_LIMITS: PromptContextLimits = {
  maxTotalChars: 36_000,
  briefSheetChars: 12_000,
  memoChars: 14_000,
  instructionChars: 1_200,
  keywordsChars: 1_200,
  maxSearchItems: 12,
  maxSearchSectionChars: 14_000,
  maxSearchContentCharsPerItem: 1_600,
  maxFileItems: 4,
  maxFileSectionChars: 14_000,
  maxFileTextCharsPerItem: 3_500,
} as const;

function normalizeSearchResultsForStorage(
  results: PromptSearchResultInput[]
): Array<{ title: string; url: string; content: string }> {
  return dedupeSearchResults(results).slice(0, 40);
}

function normalizeChatHistory(
  rows: unknown
): Array<{ role: "user" | "assistant"; text: string; created_at: string }> {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as MemoChatInput;
      if (
        (item.role !== "user" && item.role !== "assistant") ||
        typeof item.text !== "string"
      ) {
        return null;
      }

      return {
        role: item.role,
        text: item.text.trim(),
        created_at:
          typeof item.created_at === "string"
            ? item.created_at
            : new Date().toISOString(),
      } as const;
    })
    .filter((row): row is { role: "user" | "assistant"; text: string; created_at: string } => {
      return !!row?.text;
    });
}

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user, profile } = auth;

      const body = await parseJsonBody(request);
      const { projectId } = body;

      // useChat's DefaultChatTransport sends data inside messages array
      // The frontend encodes briefSheet/searchResults/keywords as JSON in the user message text
      let briefSheet = body.briefSheet || "";
      let searchResults = body.searchResults || [];
      let fileTexts = body.fileTexts || [];
      let keywords = body.keywords || "";
      let existingMemo = body.existingMemo || "";
      let instruction = body.instruction || "";
      let chatHistory = body.chatHistory || [];

      if (
        (!briefSheet || !existingMemo || !instruction) &&
        body.messages?.length
      ) {
        // Extract from the last user message (which contains JSON-encoded data)
        const lastUserMsg = [...body.messages]
          .reverse()
          .find((m: Record<string, unknown>) => m.role === "user");
        if (lastUserMsg) {
          let msgText = "";
          if (typeof lastUserMsg.content === "string") {
            msgText = lastUserMsg.content;
          } else if (lastUserMsg.parts) {
            const parts = lastUserMsg.parts as Array<{ type: string; text?: string }>;
            msgText = parts
              .filter((p) => p.type === "text")
              .map((p) => p.text || "")
              .join("");
          }
          try {
            const parsed = JSON.parse(msgText);
            briefSheet = parsed.briefSheet || briefSheet;
            searchResults = parsed.searchResults || searchResults;
            keywords = parsed.keywords || keywords;
            fileTexts = parsed.fileTexts || fileTexts;
            existingMemo = parsed.existingMemo || existingMemo;
            instruction = parsed.instruction || instruction;
            chatHistory = parsed.chatHistory || chatHistory;
          } catch {
            // Not JSON — use as-is (plain text prompt)
          }
        }
      }

      const normalizedKeywords = normalizeKeywordTextToQueries(
        sanitizeText(keywords)
      );
      const promptContextData = buildResearchPromptContext({
        briefSheet: briefSheet,
        memo: existingMemo,
        instruction,
        keywords: normalizedKeywords,
        searchResults: (Array.isArray(searchResults)
          ? searchResults
          : []) as PromptSearchResultInput[],
        fileTexts: (Array.isArray(fileTexts) ? fileTexts : []) as PromptFileTextInput[],
        limits: RESEARCH_CONTEXT_LIMITS,
      });
      const {
        context: promptContext,
        memoText: existingMemoText,
        instructionText,
        searchSection,
        fileSection,
      } = promptContextData;
      const knowledge = await fetchResearchKnowledgeContext({
        teamId: profile.team_id,
        briefSheet,
        keywords: normalizedKeywords,
        instruction,
        memo: existingMemo,
      });
      const promptContextWithKnowledge = knowledge.context
        ? `${promptContext}\n\n${knowledge.context}`
        : promptContext;

      // 部分編集モード: instruction ありかつ既存メモがある場合
      const isPartialEdit = !!(instructionText && existingMemoText);

      const taskPrompt = isPartialEdit
        ? "以下の追加指示に従い、既存リサーチメモの該当セクションだけを修正して出力してください。変更不要のセクションは出力しないでください。"
        : instructionText
          ? "既存のリサーチメモを土台に、追加指示を反映してメモ全体を更新してください。構成見出しは維持しつつ、根拠不足の箇所は明記してください。"
          : existingMemoText
            ? "既存のリサーチメモを土台に、新規の検索結果を反映して更新してください。既存情報は残しつつ、不正確な記述は修正してください。"
            : "以下の情報をもとにリサーチメモを作成してください。";

      const systemPrompt = isPartialEdit
        ? RESEARCH_MEMO_EDIT_PROMPT
        : RESEARCH_MEMO_PROMPT;

      const normalizedSearchResults = normalizeSearchResultsForStorage(
        (Array.isArray(searchResults) ? searchResults : []) as PromptSearchResultInput[]
      );
      const parsedKeywordQueries = extractQueriesFromKeywords(
        normalizedKeywords
      );
      const normalizedChatHistory = normalizeChatHistory(chatHistory);

      console.log(
        `[research] mode=${isPartialEdit ? "partial" : "full"} contextChars=${promptContextWithKnowledge.length} existingMemo=${existingMemoText ? 1 : 0} instruction=${instructionText ? 1 : 0} search=${searchSection.included}/${searchSection.total} files=${fileSection.included}/${fileSection.total} kb=${knowledge.chunkCount}`
      );

      const result = streamText({
        model: sonnet,
        system: systemPrompt,
        prompt: `${taskPrompt}\n\n${promptContextWithKnowledge}`,
        async onFinish({ text, totalUsage }) {
          await recordAiUsage({
            supabase,
            endpoint: "/api/ai/research",
            operation: "streamText",
            model: "claude-sonnet-4-5-20250929",
            userId: user.id,
            projectId,
            promptChars: taskPrompt.length + promptContextWithKnowledge.length,
            completionChars: text.length,
            usage: totalUsage,
          });

          // 部分編集の場合はマージした結果を保存
          const finalMarkdown = isPartialEdit
            ? mergeMemoSections(existingMemo, text)
            : text;

          if (projectId) {
            await supabase.from("research_memos").upsert(
              {
                project_id: projectId,
                theme_keywords: normalizedKeywords,
                search_queries: parsedKeywordQueries,
                search_results: normalizedSearchResults,
                raw_markdown: finalMarkdown,
                content: {
                  chat_history: normalizedChatHistory,
                  latest_instruction: instructionText || null,
                },
              },
              { onConflict: "project_id" }
            );
          }
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "research",
      fallbackMessage: "リサーチメモ生成に失敗しました",
    }
  );
}
