import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { opus } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { windowByText } from "@/lib/ai/history-window";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { buildDiscussionPrompt } from "@/lib/ai/prompts/discussion";

// Convert UI messages (parts array) to core messages (content string)
function convertToCoreMessages(
  uiMessages: Array<Record<string, unknown>>
): Array<{ role: "user" | "assistant"; content: string }> {
  return uiMessages.map((msg) => {
    const role = msg.role as "user" | "assistant";
    // If already in core format (has content string), use as-is
    if (typeof msg.content === "string") {
      return { role, content: msg.content };
    }
    // Convert from UI message format (parts array) to core format
    const parts = (msg.parts as Array<{ type: string; text?: string }>) || [];
    const textContent =
      parts
        .filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("") || "";
    return { role, content: textContent };
  });
}

export async function POST(request: Request) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const body = await parseJsonBody(request);
      const { projectId, brainstormId } = body;

      const fullMessages = convertToCoreMessages(body.messages || []);
      const promptMessages = windowByText(fullMessages, (m) => m.content, {
        preserveHeadItems: 2,
        maxItems: 28,
        maxTotalChars: 22_000,
      });

      if (promptMessages.length < fullMessages.length) {
        console.log(
          `[discussion] Windowed history ${fullMessages.length} -> ${promptMessages.length}`
        );
      }

      // アップロード済み資料を取得してプロンプトに含める
      let documentContext = "";
      if (brainstormId) {
        const { data: uploadedFiles } = await supabase
          .from("brainstorm_uploaded_files")
          .select("file_name, extracted_text")
          .eq("brainstorm_id", brainstormId);

        if (uploadedFiles?.length) {
          const docs = uploadedFiles
            .filter((f) => f.extracted_text)
            .map((f) => `### ${f.file_name}\n${f.extracted_text}`)
            .join("\n\n---\n\n");
          if (docs) {
            documentContext = `\n\n## 与件資料（クライアントから提供された資料）\n以下の資料内容を踏まえてディスカッションしてください。\n\n${docs}`;
          }
        }
      } else if (projectId) {
        const { data: uploadedFiles } = await supabase
          .from("uploaded_files")
          .select("file_name, extracted_text")
          .eq("project_id", projectId)
          .eq("purpose", "discussion");

        if (uploadedFiles?.length) {
          const docs = uploadedFiles
            .filter((f) => f.extracted_text)
            .map((f) => `### ${f.file_name}\n${f.extracted_text}`)
            .join("\n\n---\n\n");
          if (docs) {
            documentContext = `\n\n## 与件資料（クライアントから提供された資料）\n以下の資料内容を踏まえてディスカッションしてください。\n\n${docs}`;
          }
        }
      }

      const systemPrompt = buildDiscussionPrompt() + documentContext;
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
            endpoint: "/api/ai/discussion",
            operation: "streamText",
            model: "claude-opus-4-6",
            userId: user.id,
            projectId,
            promptChars,
            completionChars: text.length,
            usage: totalUsage,
            metadata: {
              ...(brainstormId ? { brainstorm_id: brainstormId } : {}),
              cacheReadInputTokens,
              cacheCreationInputTokens,
            },
          });

          // Save chat history after stream completes
          const allMessages = [
            ...fullMessages,
            { role: "assistant" as const, content: text },
          ];
          if (brainstormId) {
            await supabase
              .from("brainstorm_sessions")
              .update({
                chat_history: allMessages,
                updated_at: new Date().toISOString(),
              })
              .eq("id", brainstormId)
              .then(() => {});
          } else if (projectId) {
            await supabase
              .from("brief_sheets")
              .upsert(
                {
                  project_id: projectId,
                  chat_history: allMessages,
                },
                { onConflict: "project_id" }
              )
              .then(() => {});
          }
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "discussion",
      fallbackMessage: "ディスカッション生成に失敗しました",
    }
  );
}
