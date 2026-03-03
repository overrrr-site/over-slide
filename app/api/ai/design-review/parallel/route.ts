import { opus, gemini, gpt } from "@/lib/ai/anthropic";
import { parseJsonBody } from "@/lib/api/validation";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { DESIGN_REVIEW_PROMPT } from "@/lib/ai/prompts/design-review";
import { runParallelReviews, type ReviewModelConfig } from "@/lib/ai/parallel-review";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { getStyleGuideContext } from "@/lib/style-guide/context";

const REVIEW_MODELS: ReviewModelConfig[] = [
  {
    model: opus,
    key: "claude",
    label: "Claude Opus 4.6",
    modelName: "claude-opus-4-6",
  },
  {
    model: gemini,
    key: "gemini",
    label: "Gemini 3.1 Pro",
    modelName: "gemini-3.1-pro-preview",
  },
  { model: gpt, key: "gpt", label: "GPT-5.2", modelName: "gpt-5.2" },
];

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const {
        projectId,
        pageContents,
        briefSheet,
        deepMode = false,
        selectedModels,
      } = await parseJsonBody(request);

      const teamId = await getTeamIdForUser(supabase, user.id);
      if (!teamId) {
        return Response.json({ error: "Profile not found" }, { status: 404 });
      }

      // スタイルガイドを取得
      let styleGuideContext = "";
      try {
        styleGuideContext = await getStyleGuideContext(supabase, user.id);
      } catch {
        // 取得失敗は致命的ではない
      }

      const prompt = [
        styleGuideContext,
        `## ブリーフシート\n${briefSheet}`,
        `## 提案書コンテンツ（デザイン後）\n${compactJsonForPrompt(pageContents)}`,
        "\n上記の提案書の「デザイン・レイアウト」を4つの観点からレビューしてください。内容の論理性には言及不要です。JSONのみ出力してください。",
      ]
        .filter(Boolean)
        .join("\n\n");

      const requestedModelKeys = Array.isArray(selectedModels)
        ? (selectedModels as string[])
        : REVIEW_MODELS.map((m) => m.key);
      const activeModelKeys = deepMode ? requestedModelKeys : ["gemini"];
      const activeModels = REVIEW_MODELS.filter((model) =>
        activeModelKeys.includes(model.key)
      );
      const modelsToRun =
        activeModels.length > 0
          ? activeModels
          : REVIEW_MODELS.filter((model) => model.key === "gemini");

      const { signal, cleanup } = createTimeoutController(300_000);

      try {
        const reviews = await runParallelReviews({
          supabase,
          userId: user.id,
          teamId,
          projectId,
          endpoint: "/api/ai/design-review/parallel",
          prompt,
          system: DESIGN_REVIEW_PROMPT,
          models: modelsToRun,
          maxOutputTokens: 8192,
          abortSignal: signal,
        });

        // Save to DB with review_type = 'design'
        if (projectId) {
          try {
            await supabase.from("reviews").insert({
              project_id: projectId,
              version: 1,
              review_data: { parallel: true, reviews },
              review_type: "design",
              status: "pending",
            });
          } catch {
            // Non-critical
          }
        }

        return Response.json({ reviews });
      } finally {
        cleanup();
      }
    },
    {
      context: "design-review/parallel",
      fallbackMessage: "デザインレビューの生成に失敗しました",
    }
  );
}
