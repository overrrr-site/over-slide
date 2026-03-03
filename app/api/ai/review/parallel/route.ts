import { opus, gemini, gpt } from "@/lib/ai/anthropic";
import { parseJsonBody } from "@/lib/api/validation";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { REVIEW_PROMPT } from "@/lib/ai/prompts/review";
import { runParallelReviews, type ReviewModelConfig } from "@/lib/ai/parallel-review";
import { requireAuth } from "@/lib/api/auth";
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
        researchMemo,
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
        `## リサーチメモ\n${researchMemo}`,
        `## 提案書コンテンツ\n${compactJsonForPrompt(pageContents)}`,
        "\n上記の提案書を5つの観点からレビューしてください。",
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

      const reviews = await runParallelReviews({
        supabase,
        userId: user.id,
        teamId,
        projectId,
        endpoint: "/api/ai/review/parallel",
        prompt,
        system: REVIEW_PROMPT,
        models: modelsToRun,
      });

      // Save to DB
      if (projectId) {
        try {
          await supabase.from("reviews").insert({
            project_id: projectId,
            version: 1,
            review_data: { parallel: true, reviews },
            status: "pending",
          });
        } catch {
          // Non-critical
        }
      }

      return Response.json({ reviews });
    },
    {
      context: "review/parallel",
      fallbackMessage: "レビューの生成に失敗しました",
    }
  );
}
