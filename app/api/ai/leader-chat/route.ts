import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { opus } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { windowByText } from "@/lib/ai/history-window";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import { getTeamIdForUser } from "@/lib/api/team";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import { buildLeaderSystemPrompt } from "@/lib/ai/prompts/leader";
import {
  loadResearchContext,
  loadStructureContext,
  loadDetailsContext,
  loadDesignContext,
  loadBriefContext,
  loadStalenessContext,
} from "@/lib/ai/context-loaders";
import type { SupabaseClient } from "@supabase/supabase-js";

const LEADER_STEP = 0;

/** Convert UI messages (parts array) to core messages (content string) */
function convertToCoreMessages(
  uiMessages: Array<Record<string, unknown>>
): Array<{ role: "user" | "assistant"; content: string }> {
  return uiMessages.map((msg) => {
    const role = msg.role as "user" | "assistant";
    if (typeof msg.content === "string") {
      return { role, content: msg.content };
    }
    const parts = (msg.parts as Array<{ type: string; text?: string }>) || [];
    const textContent =
      parts
        .filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("") || "";
    return { role, content: textContent };
  });
}

function getStepName(step: number): string {
  return WORKFLOW_STEPS.find((s) => s.id === step)?.name || `工程${step}`;
}

/** Parse <!--APPLY{...}APPLY--> and persist changes to DB (supports target_step) */
async function persistLeaderApplyChanges(
  supabase: SupabaseClient,
  projectId: string,
  text: string
): Promise<void> {
  const match = text.match(/<!--APPLY([\s\S]*?)APPLY-->/);
  if (!match) return;

  try {
    const payload = JSON.parse(match[1]);
    const targetStep = payload.target_step as number;

    // Only steps 2 and 3 have server-side persistence
    if (targetStep !== 2 && targetStep !== 3) return;

    const { data: structureData } = await supabase
      .from("structures")
      .select("id, pages")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!structureData) return;

    // Step 2: Structure changes
    if (targetStep === 2) {
      let updatedPages: unknown[] | null = null;

      if (payload.action === "revise_page" && payload.revisedPage) {
        const currentPages = structureData.pages as Array<{
          page_number: number;
          [key: string]: unknown;
        }>;
        updatedPages = currentPages.map((p) =>
          p.page_number === payload.revisedPage.page_number
            ? { ...payload.revisedPage }
            : p
        );
      } else if (payload.action === "revise_all" && payload.revisedPages) {
        updatedPages = payload.revisedPages;
      }

      if (updatedPages) {
        await supabase
          .from("structures")
          .update({
            pages: updatedPages as unknown as Record<string, unknown>[],
          })
          .eq("id", structureData.id);
        console.log(
          `[leader-chat] Applied structure changes for project ${projectId}`
        );
      }
    }

    // Step 3: Details (page_contents) changes
    if (targetStep === 3) {
      if (payload.action === "revise_page" && payload.revisedPage) {
        const revised = payload.revisedPage as {
          page_number: number;
          [key: string]: unknown;
        };
        await supabase.from("page_contents").upsert(
          {
            structure_id: structureData.id,
            page_number: revised.page_number,
            content: revised,
          },
          { onConflict: "structure_id,page_number" }
        );
        console.log(
          `[leader-chat] Applied details change for page ${revised.page_number}`
        );
      } else if (payload.action === "revise_all" && payload.revisedPages) {
        const pages = payload.revisedPages as Array<{
          page_number: number;
          [key: string]: unknown;
        }>;
        const rows = pages.map((p) => ({
          structure_id: structureData.id,
          page_number: p.page_number,
          content: p,
        }));
        await supabase
          .from("page_contents")
          .upsert(rows, { onConflict: "structure_id,page_number" });
        console.log(
          `[leader-chat] Applied details changes for ${pages.length} pages`
        );
      }
    }
  } catch (err) {
    console.error("[leader-chat] Failed to persist APPLY changes:", err);
  }
}

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) return auth;
      const { supabase, user } = auth;

      const body = await parseJsonBody(request);
      const { projectId, currentDisplayStep } = body;

      if (!projectId) {
        return Response.json(
          { error: "projectId is required" },
          { status: 400 }
        );
      }

      const displayStep = (currentDisplayStep as number) || 1;
      const fullMessages = convertToCoreMessages(body.messages || []);

      // Determine RAG query from last user message
      const lastUserMsg = fullMessages[fullMessages.length - 1];
      const ragQuery = lastUserMsg?.role === "user" ? lastUserMsg.content : "";

      // Load ALL step contexts + summaries in parallel
      const ragLoader = ragQuery
        ? getTeamIdForUser(supabase, user.id).then((teamId) =>
            buildRagContext({
              query: ragQuery,
              teamId,
              chunkTypes: ["composition", "correction", "expression", "style"],
              limit: 4,
              logContext: "leader-chat",
            })
          )
        : Promise.resolve("");

      const summariesLoader = Promise.resolve(
        supabase
          .from("project_chat_summaries")
          .select("step, summary")
          .eq("project_id", projectId)
          .order("step", { ascending: true })
      )
        .then(({ data }) =>
          (data || []).map(
            (r: { step: number; summary: string }) =>
              `### ${getStepName(r.step)}\n${r.summary}`
          )
        )
        .catch(() => [] as string[]);

      const [
        researchContext,
        structureContext,
        detailsContext,
        designContext,
        briefSummary,
        summaries,
        ragContext,
        stalenessContext,
      ] = await Promise.all([
        loadResearchContext(supabase, projectId),
        loadStructureContext(supabase, projectId),
        loadDetailsContext(supabase, projectId),
        loadDesignContext(supabase, projectId),
        loadBriefContext(supabase, projectId),
        summariesLoader,
        ragLoader,
        loadStalenessContext(supabase, projectId),
      ]);

      // Window messages with larger budget for Opus
      const promptMessages = windowByText(fullMessages, (m) => m.content, {
        preserveHeadItems: 2,
        maxItems: 40,
        maxTotalChars: 30_000,
      });

      const systemPrompt = buildLeaderSystemPrompt({
        briefSummary,
        stepSummaries: summaries,
        researchContext,
        structureContext,
        detailsContext,
        designContext,
        ragContext,
        stalenessContext,
        currentDisplayStep: displayStep,
      });

      const promptChars =
        systemPrompt.length +
        promptMessages.reduce((sum, msg) => sum + msg.content.length, 0);

      const result = streamText({
        model: opus,
        system: systemPrompt,
        messages: promptMessages,
        providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
        async onFinish({ text, totalUsage, providerMetadata }) {
          const { cacheReadInputTokens, cacheCreationInputTokens } =
            extractAnthropicCacheMetrics(providerMetadata);

          await recordAiUsage({
            supabase,
            endpoint: "/api/ai/leader-chat",
            operation: "streamText",
            model: "claude-opus-4-6",
            userId: user.id,
            projectId,
            promptChars,
            completionChars: text.length,
            usage: totalUsage,
            metadata: {
              step: LEADER_STEP,
              cacheReadInputTokens,
              cacheCreationInputTokens,
            },
          });

          // Save user message + assistant response with step=0 (leader)
          const lastUserMsg = fullMessages[fullMessages.length - 1];
          if (lastUserMsg?.role === "user") {
            await supabase.from("project_chat_messages").insert({
              project_id: projectId,
              step: LEADER_STEP,
              role: "user",
              content: lastUserMsg.content,
            });
          }

          await supabase.from("project_chat_messages").insert({
            project_id: projectId,
            step: LEADER_STEP,
            role: "assistant",
            content: text,
          });

          // Persist APPLY changes to DB
          await persistLeaderApplyChanges(supabase, projectId, text);
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "leader-chat",
      fallbackMessage: "リーダーAIの応答に失敗しました",
    }
  );
}
