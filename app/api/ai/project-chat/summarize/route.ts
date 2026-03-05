import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { sonnet } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { cachedGenerateText } from "@/lib/ai/cached-generation";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import { getTeamIdForUser } from "@/lib/api/team";

function getStepName(step: number): string {
  return WORKFLOW_STEPS.find((s) => s.id === step)?.name || `工程${step}`;
}

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) return auth;
      const { supabase, user } = auth;

      const body = await parseJsonBody(request);
      const { projectId, step } = body;

      if (!projectId || !step) {
        return Response.json(
          { error: "projectId and step are required" },
          { status: 400 }
        );
      }

      // Load all messages for this step
      const { data: messages } = await supabase
        .from("project_chat_messages")
        .select("role, content")
        .eq("project_id", projectId)
        .eq("step", step)
        .order("created_at", { ascending: true });

      if (!messages || messages.length === 0) {
        return Response.json({ summary: null, message: "No messages to summarize" });
      }

      // Build conversation text for summarization
      const conversationText = messages
        .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
        .join("\n\n");

      const stepName = getStepName(step);
      const prompt = `以下は「${stepName}」工程でのユーザーとAIの会話です。

${conversationText}

---

上記の会話を、次の工程のAIが参考にできるように要約してください。

要約のルール:
- 200〜400字程度で簡潔にまとめる
- ユーザーが決定した方向性・具体的な修正内容を中心に記録する
- 曖昧な議論は省略し、最終的な結論のみ残す
- 箇条書きで構造化する
- 「〜について議論しました」のような抽象的な記述は避け、具体的な決定事項を書く`;

      const teamId = await getTeamIdForUser(supabase, user.id);
      const {
        text,
        usage,
        providerMetadata,
        cacheHit,
        cacheLayer,
        cacheKeyPrefix,
        requestFingerprintVersion,
      } = await cachedGenerateText({
        supabase,
        teamId,
        endpoint: "/api/ai/project-chat/summarize",
        modelName: "claude-sonnet-4-5-20250929",
        model: sonnet,
        prompt,
        maxOutputTokens: 1024,
        providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
        cacheMetadata: { step },
      });
      const { cacheReadInputTokens, cacheCreationInputTokens } =
        extractAnthropicCacheMetrics(providerMetadata);

      await recordAiUsage({
        supabase,
        endpoint: "/api/ai/project-chat/summarize",
        operation: "generateText",
        model: "claude-sonnet-4-5-20250929",
        userId: user.id,
        projectId,
        teamId,
        promptChars: prompt.length,
        completionChars: text.length,
        usage,
        metadata: {
          step,
          cacheHit,
          cacheLayer,
          cacheKeyPrefix,
          cacheReadInputTokens,
          cacheCreationInputTokens,
          requestFingerprintVersion,
        },
      });

      // Upsert summary (one per project+step)
      const { error: upsertErr } = await supabase
        .from("project_chat_summaries")
        .upsert(
          {
            project_id: projectId,
            step,
            summary: text,
          },
          { onConflict: "project_id,step" }
        );

      if (upsertErr) {
        console.error("[project-chat/summarize] Upsert failed:", upsertErr);
        return Response.json(
          { error: "Failed to save summary" },
          { status: 500 }
        );
      }

      console.log(
        `[project-chat/summarize] Summarized step ${step} for project ${projectId} (${messages.length} messages → ${text.length} chars)`
      );

      return Response.json({ summary: text });
    },
    {
      context: "project-chat/summarize",
      fallbackMessage: "会話要約に失敗しました",
    }
  );
}
