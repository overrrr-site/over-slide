import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { z } from "zod";
import { sonnet } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import {
  cachedGenerateObject,
  cachedGenerateText,
} from "@/lib/ai/cached-generation";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { KNOWLEDGE_ANALYSIS_PROMPT } from "@/lib/ai/prompts/knowledge-analysis";
import { recordAiUsage } from "@/lib/ai/usage-logger";


const analysisSchema = z.object({
  composition: z.string().describe("全体構成パターンの分析（200-400字）"),
  pages: z.array(z.object({
    pageNumber: z.number().describe("ページ番号"),
    masterType: z.string().describe("COVER | SECTION | CONTENT_1COL | CONTENT_2COL | CONTENT_VISUAL | DATA_HIGHLIGHT | CLOSING"),
    title: z.string().describe("ページタイトル"),
    content: z.string().describe("このページの内容要約と特徴的な表現パターン"),
  })),
  style: z.string().describe("文体分析（語調、専門用語の使い方、論理展開のパターン、200-400字）"),
  expressions: z.array(z.string()).describe("汎用的に再利用できる表現フレーズ（10-20個）"),
});

// generateObject用の簡潔なプロンプト（JSON形式指示を含まない）
const ANALYSIS_SYSTEM_FOR_STRUCTURED = `あなたは企画提案書の構成・文体分析の専門家です。
与えられた提案書のテキストを分析し、以下の4つの観点で情報を抽出してください。

1. composition: ページ構成の流れ、ストーリーライン、セクション分割のパターン
2. pages: 各ページの役割とレイアウトタイプ（masterTypeはCOVER/SECTION/CONTENT_1COL/CONTENT_2COL/CONTENT_VISUAL/DATA_HIGHLIGHT/CLOSINGのいずれか）
3. style: 語調（です/ます調、だ/である調）、専門用語の使い方、論理展開のパターン、説得力を高めるテクニック
4. expressions: 汎用的に再利用できるフレーズを10-20個抽出`;

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  const { docId } = await request.json();
  if (!docId) {
    return NextResponse.json({ error: "docId is required" }, { status: 400 });
  }

  // Fetch document record
  const { data: doc, error: docError } = await supabase
    .from("knowledge_docs")
    .select("*")
    .eq("id", docId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // モードB（content）の場合はスタイル分析をスキップし、成功ステータスで返す
  if (doc.purpose === "content") {
    await supabase
      .from("knowledge_docs")
      .update({ analysis_status: "analyzed" })
      .eq("id", docId);

    return NextResponse.json({
      docId,
      skipped: true,
      reason: "content目的のドキュメントはスタイル分析をスキップします",
    });
  }

  // Update status to analyzing
  await supabase
    .from("knowledge_docs")
    .update({ analysis_status: "analyzing" })
    .eq("id", docId);

  // Timeout: abort after 180 seconds
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), 180_000);

  try {
    // アップロード時に保存済みの抽出テキストを取得（PDFの再解析を避ける）
    const textPath = doc.storage_path + ".extracted.txt";
    const { data: textData, error: dlError } = await supabase.storage
      .from("uploads")
      .download(textPath);

    if (dlError || !textData) {
      throw new Error(
        `抽出済みテキストが見つかりません。資料を再アップロードしてください: ${dlError?.message}`
      );
    }

    const text = await textData.text();

    if (!text || text.trim().length === 0) {
      throw new Error("ファイルからテキストを抽出できませんでした");
    }

    // Analyze with Claude Sonnet
    // Try structured output first, fallback to text + JSON extraction
    const docText = text.slice(0, 50000);
    let analysis: z.infer<typeof analysisSchema>;

    try {
      // Primary: generateObject (structured output via tool calling)
      const {
        object: analysisObject,
        usage,
        providerMetadata,
        cacheHit,
        cacheLayer,
        cacheKeyPrefix,
        requestFingerprintVersion,
      } = await cachedGenerateObject<z.infer<typeof analysisSchema>>({
        supabase,
        teamId: profile.team_id,
        endpoint: "/api/knowledge/analyze",
        modelName: "claude-sonnet-4-5-20250929",
        model: sonnet,
        schema: analysisSchema,
        system: ANALYSIS_SYSTEM_FOR_STRUCTURED,
        prompt: `以下の提案書テキストを分析してください:\n\n${docText}`,
        maxOutputTokens: 8192,
        abortSignal: controller.signal,
        providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
        cacheMetadata: { stage: "structured", docId },
      });
      const { cacheReadInputTokens, cacheCreationInputTokens } =
        extractAnthropicCacheMetrics(providerMetadata);
      analysis = analysisObject;
      await recordAiUsage({
        supabase,
        endpoint: "/api/knowledge/analyze",
        operation: "generateText",
        model: "claude-sonnet-4-5-20250929",
        userId: user.id,
        teamId: profile.team_id,
        promptChars: docText.length + ANALYSIS_SYSTEM_FOR_STRUCTURED.length,
        completionChars: JSON.stringify(analysis).length,
        usage,
        metadata: {
          stage: "structured",
          docId,
          cacheHit,
          cacheLayer,
          cacheKeyPrefix,
          cacheReadInputTokens,
          cacheCreationInputTokens,
          requestFingerprintVersion,
        },
      });
      console.log(`[Knowledge Analysis] generateObject succeeded for docId=${docId}`);
    } catch (structuredErr) {
      console.warn(
        `[Knowledge Analysis] generateObject failed, falling back to generateText:`,
        structuredErr instanceof Error ? structuredErr.message : structuredErr
      );

      // Fallback: generateText + JSON extraction
      const {
        text: rawText,
        usage,
        providerMetadata,
        cacheHit,
        cacheLayer,
        cacheKeyPrefix,
        requestFingerprintVersion,
      } = await cachedGenerateText({
        supabase,
        teamId: profile.team_id,
        endpoint: "/api/knowledge/analyze",
        modelName: "claude-sonnet-4-5-20250929",
        model: sonnet,
        system: KNOWLEDGE_ANALYSIS_PROMPT,
        prompt: `以下の提案書テキストを分析してください:\n\n${docText}`,
        maxOutputTokens: 8192,
        abortSignal: controller.signal,
        providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
        cacheMetadata: { stage: "fallback", docId },
      });
      const { cacheReadInputTokens, cacheCreationInputTokens } =
        extractAnthropicCacheMetrics(providerMetadata);

      // Extract JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AIの応答からJSONを抽出できませんでした");
      }

      // Clean up common JSON issues
      let cleaned = jsonMatch[0]
        // Remove control characters (except \n \r \t)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
        // Fix trailing commas before } or ]
        .replace(/,\s*([}\]])/g, "$1");

      try {
        const parsed = JSON.parse(cleaned);
        // Validate with Zod (use partial to salvage what we can)
        analysis = analysisSchema.parse(parsed);
      } catch {
        // Last resort: try to fix unescaped newlines in string values
        cleaned = cleaned.replace(
          /"([^"]*?)"/g,
          (_match, content: string) => `"${content.replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`
        );
        const parsed = JSON.parse(cleaned);
        analysis = analysisSchema.parse(parsed);
      }
      await recordAiUsage({
        supabase,
        endpoint: "/api/knowledge/analyze",
        operation: "generateText",
        model: "claude-sonnet-4-5-20250929",
        userId: user.id,
        teamId: profile.team_id,
        promptChars: docText.length + KNOWLEDGE_ANALYSIS_PROMPT.length,
        completionChars: rawText.length,
        usage,
        metadata: {
          stage: "fallback",
          docId,
          cacheHit,
          cacheLayer,
          cacheKeyPrefix,
          cacheReadInputTokens,
          cacheCreationInputTokens,
          requestFingerprintVersion,
        },
      });
      console.log(`[Knowledge Analysis] generateText fallback succeeded for docId=${docId}`);
    }

    // Save analysis result
    const { error: updateError } = await supabase
      .from("knowledge_docs")
      .update({
        analysis,
        analysis_status: "analyzed",
      })
      .eq("id", docId);

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    return NextResponse.json({ docId, analysis });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analysis failed";
    console.error(`[Knowledge Analysis Error] docId=${docId}:`, err);

    await supabase
      .from("knowledge_docs")
      .update({ analysis_status: "error" })
      .eq("id", docId);

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(abortTimeout);
  }
}
