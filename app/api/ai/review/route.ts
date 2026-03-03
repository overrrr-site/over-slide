import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { opus } from "@/lib/ai/anthropic";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { REVIEW_PROMPT } from "@/lib/ai/prompts/review";

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, pageContents, researchMemo, briefSheet } =
        await parseJsonBody(request);

      const prompt = [
        `## ブリーフシート\n${briefSheet}`,
        `## リサーチメモ\n${researchMemo}`,
        `## 提案書コンテンツ\n${compactJsonForPrompt(pageContents)}`,
        "\n上記の提案書を5つの観点からレビューしてください。",
      ].join("\n\n");

      const result = streamText({
        model: opus,
        system: REVIEW_PROMPT,
        prompt,
        async onFinish({ text, totalUsage }) {
          await recordAiUsage({
            supabase,
            endpoint: "/api/ai/review",
            operation: "streamText",
            model: "claude-opus-4-6",
            userId: user.id,
            projectId,
            promptChars: prompt.length,
            completionChars: text.length,
            usage: totalUsage,
          });

          if (projectId) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                await supabase.from("reviews").insert({
                  project_id: projectId,
                  version: 1,
                  review_data: parsed,
                  status: "pending",
                });
              } catch {
                // Parse failure is non-critical
              }
            }
          }
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "review",
      fallbackMessage: "レビュー生成に失敗しました",
    }
  );
}
