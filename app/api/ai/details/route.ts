import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { sonnet } from "@/lib/ai/anthropic";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DETAILS_PROMPT, DOCUMENT_DETAILS_PROMPT } from "@/lib/ai/prompts/details";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { searchKnowledge, formatRetrievedContext } from "@/lib/knowledge/retriever";

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
      let structure = body.structure || null;
      let researchMemo = body.researchMemo || "";

      if (!structure && body.messages?.length) {
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
            structure = parsed.structure || structure;
            researchMemo = parsed.researchMemo || researchMemo;
          } catch {
            // Not JSON — use as-is
          }
        }
      }

      // output_type と確定済みメッセージを取得
      let outputType = "slide";
      let confirmedMessages: { page_number: number; message: string }[] = [];

      if (projectId) {
        const [projectResult, structureResult] = await Promise.all([
          supabase
            .from("projects")
            .select("output_type")
            .eq("id", projectId)
            .single(),
          supabase
            .from("structures")
            .select("pages")
            .eq("project_id", projectId)
            .order("version", { ascending: false })
            .limit(1)
            .single(),
        ]);

        if (projectResult.data?.output_type) {
          outputType = projectResult.data.output_type;
        }

        // 構成の各ページから確定済み message を抽出
        if (structureResult.data?.pages && Array.isArray(structureResult.data.pages)) {
          confirmedMessages = (structureResult.data.pages as Array<{ page_number: number; message?: string }>)
            .filter((p) => p.message)
            .map((p) => ({ page_number: p.page_number, message: p.message! }));
        }
      }

      // RAG: Retrieve style and expression patterns
      let ragContext = "";
      if (profile.team_id) {
        try {
          const chunks = await searchKnowledge("提案書の文体と表現パターン", {
            teamId: profile.team_id,
            chunkTypes: ["style", "expression", "correction"],
            limit: 7,
          });
          ragContext = formatRetrievedContext(chunks);
        } catch {
          // RAG failure is non-critical
        }
      }

      // 確定済みメッセージをプロンプトに含める
      const messagesSection = confirmedMessages.length > 0
        ? confirmedMessages.map((m) => `P${m.page_number}: ${m.message}`).join("\n")
        : "";

      const systemPrompt = outputType === "document"
        ? DOCUMENT_DETAILS_PROMPT
        : DETAILS_PROMPT;

      const prompt = [
        `<input>`,
        `<output_type>${outputType === "document" ? "ドキュメント" : "スライド"}</output_type>`,
        `<structure>\n${compactJsonForPrompt(structure)}\n</structure>`,
        messagesSection ? `<confirmed_messages>\n${messagesSection}\n</confirmed_messages>` : "",
        researchMemo ? `<research_memo>\n${researchMemo}\n</research_memo>` : "",
        ragContext ? `<knowledge_base>\n${ragContext}\n</knowledge_base>` : "",
        `</input>`,
        "",
        "上記の入力をもとに、全ページの詳細コンテンツをJSON形式で作成してください。",
      ]
        .filter(Boolean)
        .join("\n");

      const result = streamText({
        model: sonnet,
        system: systemPrompt,
        prompt,
        async onFinish({ text, totalUsage }) {
          await recordAiUsage({
            supabase,
            endpoint: "/api/ai/details",
            operation: "streamText",
            model: "claude-sonnet-4-5-20250929",
            userId: user.id,
            teamId: profile.team_id,
            projectId,
            promptChars: prompt.length,
            completionChars: text.length,
            usage: totalUsage,
          });

          if (!projectId) return;

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error("[details onFinish] No JSON found in AI response");
            return;
          }

          try {
            // Clean up common JSON issues (control chars, trailing commas)
            let cleaned = jsonMatch[0]
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
              .replace(/,\s*([}\]])/g, "$1");

            let parsed;
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              // Retry: fix unescaped newlines in string values
              cleaned = cleaned.replace(
                /"([^"]*?)"/g,
                (_match: string, content: string) =>
                  `"${content.replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`
              );
              parsed = JSON.parse(cleaned);
            }

            if (!parsed.pages || !Array.isArray(parsed.pages)) {
              console.error("[details onFinish] parsed.pages is missing or not an array");
              return;
            }

            // Get structure id
            const { data: structureData, error: structErr } = await supabase
              .from("structures")
              .select("id")
              .eq("project_id", projectId)
              .order("version", { ascending: false })
              .limit(1)
              .single();

            if (structErr || !structureData) {
              console.error("[details onFinish] Structure query failed:", structErr);
              return;
            }

            console.log(`[details onFinish] structure_id=${structureData.id}, pages=${parsed.pages.length}`);

            // Upsert page_contents (matches working pattern of research/structure routes)
            const rows = parsed.pages.map(
              (page: { page_number: number; [key: string]: unknown }) => ({
                structure_id: structureData.id,
                page_number: page.page_number,
                content: page,
              })
            );

            const { error: upsertErr } = await supabase
              .from("page_contents")
              .upsert(rows, { onConflict: "structure_id,page_number" });

            if (upsertErr) {
              console.error("[details onFinish] Upsert failed:", upsertErr);
              return;
            }

            console.log(`[details onFinish] Saved ${rows.length} page_contents`);

            // Clean up extra pages if page count decreased (best-effort)
            const maxPage = Math.max(...parsed.pages.map((p: { page_number: number }) => p.page_number));
            await supabase
              .from("page_contents")
              .delete()
              .eq("structure_id", structureData.id)
              .gt("page_number", maxPage);
          } catch (err) {
            console.error("[details onFinish] Error:", err);
          }
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "details",
      fallbackMessage: "詳細コンテンツ生成に失敗しました",
    }
  );
}
