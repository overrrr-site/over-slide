import { streamText } from "ai";
import { parseJsonBody } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { sonnet } from "@/lib/ai/anthropic";
import { windowByText } from "@/lib/ai/history-window";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import { getTeamIdForUser } from "@/lib/api/team";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Load current structure pages for step 2 */
async function loadStructureContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
  const { data } = await supabase
    .from("structures")
    .select("pages")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.pages) return "";
  return compactJsonForPrompt(data.pages);
}

/** Load current page_contents for step 3 */
async function loadDetailsContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
  // Get latest structure ID
  const { data: structData } = await supabase
    .from("structures")
    .select("id")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!structData?.id) return "";

  const { data: contents } = await supabase
    .from("page_contents")
    .select("page_number, content")
    .eq("structure_id", structData.id)
    .order("page_number");

  if (!contents?.length) return "";
  return compactJsonForPrompt(
    contents.map((c) => c.content as Record<string, unknown>)
  );
}

/** Load current HTML slides metadata for step 5 */
async function loadDesignContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
  const { data: genFile } = await supabase
    .from("generated_files")
    .select("slide_data")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!genFile?.slide_data) return "";

  const slideData = genFile.slide_data as {
    slides?: Array<{ index: number; slideType: string; title: string }>;
  };
  if (!slideData.slides?.length) return "";

  // Only include metadata (not full HTML) to save tokens
  const metadata = slideData.slides.map((s, i) => ({
    slideIndex: i,
    slideType: s.slideType,
    title: s.title,
  }));
  return compactJsonForPrompt(metadata);
}

/** Load research memo + brief summary for step 1 */
async function loadResearchContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
  const [memoResult, briefResult] = await Promise.all([
    supabase
      .from("research_memos")
      .select("raw_markdown")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("brief_sheets")
      .select("client_info, background, hypothesis, goal, constraints, research_topics")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const parts: string[] = [];

  if (briefResult.data) {
    const b = briefResult.data;
    const fields = [
      b.client_info && `クライアント: ${b.client_info}`,
      b.background && `背景: ${b.background}`,
      b.hypothesis && `仮説: ${b.hypothesis}`,
      b.goal && `ゴール: ${b.goal}`,
      b.constraints && `制約: ${b.constraints}`,
      b.research_topics && `調査テーマ: ${b.research_topics}`,
    ].filter(Boolean);
    if (fields.length > 0) {
      parts.push(`### ブリーフシート\n${fields.join("\n")}`);
    }
  }

  if (memoResult.data?.raw_markdown) {
    const memo = memoResult.data.raw_markdown as string;
    // Truncate to keep token usage reasonable
    const truncated = memo.length > 3000 ? memo.slice(0, 3000) + "\n...（以下省略）" : memo;
    parts.push(`### 現在のリサーチメモ\n${truncated}`);
  }

  return parts.join("\n\n");
}

/** Build system prompt with step-specific context */
function buildSystemPrompt(
  step: number,
  summaries: string[],
  stepContext: string,
  ragContext: string = ""
): string {
  const stepName = getStepName(step);

  const summaryBlock =
    summaries.length > 0
      ? `\n\n## これまでの工程での決定事項\n${summaries.join("\n\n")}`
      : "";

  const basePrompt = `あなたはOVERWORKのAIアシスタントです。プレゼン資料やドキュメントの作成を支援します。

## 現在の工程: ${stepName}

ユーザーと対話しながら、${stepName}の内容をブラッシュアップしてください。

## あなたの役割
- ユーザーの修正要望を理解し、具体的な改善案を提示する
- 曖昧な指示に対しては、2-3の選択肢を提示して方向性を確認する
- 一度に大きく変更するのではなく、段階的に改善を重ねる
- ユーザーの意図を汲み取り、より良い提案があればプロアクティブに提案する

## 応答スタイル
- 簡潔に、分かりやすく
- 専門用語は使わない
- 修正案を提示するときは、変更のポイントを明確に説明する
${summaryBlock}${ragContext ? `\n\n## ナレッジベースからの参考情報\n以下はチームのナレッジベースから、ユーザーの発言に関連する情報を検索した結果です。関連性がある場合は回答に活用してください。\n${ragContext}` : ""}`;

  // Step 1: リサーチ — メモ修正対応モード
  if (step === 1) {
    return `${basePrompt}

## リサーチモード

ユーザーは現在、プレゼン資料の作成に必要な情報をリサーチしています。
${stepContext ? `\n${stepContext}\n` : ""}
### あなたの役割
- リサーチの方向性や不足している情報について相談にのる
- 追加で調べるべきキーワードや情報源を提案する
- リサーチ結果の整理・要約をサポートする
- 次の工程（構成作成）に向けて、どんな情報が必要か助言する
- **ユーザーからメモへの修正指示があった場合は、リサーチメモを更新する**

### メモ修正の進め方

ユーザーがリサーチメモの修正を求めたとき、以下の手順で進めてください:

1. **方向性を確認する**: 修正要望が曖昧な場合は、2-3の選択肢を提示する。選択肢は <!--OPTIONS--> マーカーで埋め込む。
2. **方向性が決まったら反映する**: 具体的な修正内容が確定したら、メモ更新を適用する。変更データは <!--APPLY--> マーカーで埋め込む。

### 選択肢の提示方法（方向性が曖昧なとき）

テキストで選択肢を説明した後、応答の末尾に以下を付加:

<!--OPTIONS{"options":[{"id":"a","label":"選択肢A","description":"説明A"},{"id":"b","label":"選択肢B","description":"説明B"}]}OPTIONS-->

### メモ更新の適用方法（方向性が確定したとき）

テキストで変更内容を説明した後、応答の末尾に以下を付加:

<!--APPLY{"action":"revise_memo","instruction":"具体的な修正指示（例：競合比較セクションを追加し、主要3社の強み・弱みを整理する）"}APPLY-->

### 重要なルール
- ユーザーが明確に「〇〇を追記して」「△△を修正して」と言っている場合は、選択肢なしですぐに APPLY する
- 曖昧な要望（「もっと充実させて」「全体的に見直して」等）は、まず OPTIONS で方向性を確認する
- APPLY の instruction には、メモをどう修正するかの具体的な指示を書く
- テキスト部分で何を変更するか簡潔に説明してから、マーカーを付加する
- 1回の応答に OPTIONS と APPLY を両方含めない
- メモの修正に関係しない一般的な質問や相談には、通常の会話で応答する`;
  }

  // Step 2: 構成作成 — 特別なインストラクション
  if (step === 2 && stepContext) {
    return `${basePrompt}

## 構成作成モード

現在のページ構成:
${stepContext}

### 修正の進め方

ユーザーが構成の修正を求めたとき、以下の手順で進めてください:

1. **方向性を確認する**: 修正要望が曖昧な場合は、2-3の選択肢を提示する。選択肢は <!--OPTIONS--> マーカーで埋め込む。
2. **方向性が決まったら反映する**: 具体的な修正内容が確定したら、変更を適用する。変更データは <!--APPLY--> マーカーで埋め込む。

### 選択肢の提示方法（方向性が曖昧なとき）

テキストで選択肢を説明した後、応答の末尾に以下を付加:

<!--OPTIONS{"options":[{"id":"a","label":"選択肢A","description":"説明A"},{"id":"b","label":"選択肢B","description":"説明B"}]}OPTIONS-->

- id は "a", "b", "c" のように短い識別子
- label は選択肢の短いタイトル（10字以内）
- description は選択肢の説明（30字以内）

### 変更の適用方法（方向性が確定したとき）

特定ページの修正:
テキストで変更内容を説明した後、応答の末尾に以下を付加:

<!--APPLY{"action":"revise_page","revisedPage":{"page_number":3,"master_type":"CONTENT_1COL","title":"...","purpose":"...","key_content":"...","message":"...","notes":"..."}}APPLY-->

全体の修正:
<!--APPLY{"action":"revise_all","revisedPages":[...全ページのJSON配列...]}APPLY-->

### 重要なルール
- ユーザーが明確に「〇〇ページを△△にして」と言っている場合は、選択肢なしですぐに APPLY する
- 曖昧な要望（「もっとインパクトを」「全体的に見直して」等）は、まず OPTIONS で方向性を確認する
- APPLY のJSONには完全なページデータを含める（差分ではなく全フィールド）
- page_number は既存の番号を維持する（勝手に変えない）
- テキスト部分で何を変更したか簡潔に説明してから、マーカーを付加する
- 1回の応答に OPTIONS と APPLY を両方含めない`;
  }

  // Step 3: 詳細作成 — 特別なインストラクション
  if (step === 3 && stepContext) {
    return `${basePrompt}

## 詳細作成モード

現在の各ページの詳細コンテンツ:
${stepContext}

### 修正の進め方

ユーザーが詳細コンテンツの修正を求めたとき、以下の手順で進めてください:

1. **方向性を確認する**: 修正要望が曖昧な場合は、2-3の選択肢を提示する。選択肢は <!--OPTIONS--> マーカーで埋め込む。
2. **方向性が決まったら反映する**: 具体的な修正内容が確定したら、変更を適用する。変更データは <!--APPLY--> マーカーで埋め込む。

### 選択肢の提示方法（方向性が曖昧なとき）

テキストで選択肢を説明した後、応答の末尾に以下を付加:

<!--OPTIONS{"options":[{"id":"a","label":"選択肢A","description":"説明A"},{"id":"b","label":"選択肢B","description":"説明B"}]}OPTIONS-->

### 変更の適用方法（方向性が確定したとき）

特定ページの修正:
テキストで変更内容を説明した後、応答の末尾に以下を付加:

<!--APPLY{"action":"revise_page","revisedPage":{"page_number":3,"master_type":"CONTENT_1COL","title":"...","subtitle":"...","body":"...","bullets":[{"text":"...","icon":"mdi:xxx"}],"kpis":[{"value":"...","label":"..."}],"notes":"..."}}APPLY-->

全体の修正:
<!--APPLY{"action":"revise_all","revisedPages":[...全ページのJSON配列...]}APPLY-->

### 重要なルール
- ユーザーが明確に「〇〇ページを△△にして」と言っている場合は、選択肢なしですぐに APPLY する
- 曖昧な要望（「もっと具体的に」「全体的に見直して」等）は、まず OPTIONS で方向性を確認する
- APPLY のJSONには完全なページデータを含める（差分ではなく全フィールド）
- page_number は既存の番号を維持する
- 各ページには master_type, title は必須。body, bullets, kpis, table, chart, notes は該当するものだけ含める
- テキスト部分で何を変更したか簡潔に説明してから、マーカーを付加する
- 1回の応答に OPTIONS と APPLY を両方含めない`;
  }

  // Step 4: 内容レビュー — アドバイスモード
  if (step === 4) {
    return `${basePrompt}

## 内容レビューモード

ユーザーは現在、AIが生成したコンテンツの内容レビューを確認しています。

### あなたの役割
- レビュー結果についてのユーザーの質問に回答する
- 改善点の優先順位付けをサポートする
- 修正案の方向性について相談にのる
- レビューで指摘された内容の具体的な改善方法を提案する

### 注意事項
- この工程では直接的なコンテンツ修正は行いません（修正は前工程に戻って行います）
- ユーザーが「採用」「不採用」を判断するためのサポートに徹する
- 必要に応じて、前工程に戻って修正することを提案する`;
  }

  // Step 5: デザイン — 特別なインストラクション
  if (step === 5 && stepContext) {
    return `${basePrompt}

## デザインモード

現在のスライド一覧:
${stepContext}

### 修正の進め方

ユーザーがスライドの修正を求めたとき、以下の手順で進めてください:

1. **方向性を確認する**: 修正要望が曖昧な場合は、2-3の選択肢を提示する。選択肢は <!--OPTIONS--> マーカーで埋め込む。
2. **方向性が決まったら反映する**: 具体的な修正内容が確定したら、変更を適用する。変更データは <!--APPLY--> マーカーで埋め込む。

### 選択肢の提示方法（方向性が曖昧なとき）

テキストで選択肢を説明した後、応答の末尾に以下を付加:

<!--OPTIONS{"options":[{"id":"a","label":"選択肢A","description":"説明A"},{"id":"b","label":"選択肢B","description":"説明B"}]}OPTIONS-->

### 変更の適用方法（方向性が確定したとき）

特定スライドの修正:
テキストで変更内容を説明した後、応答の末尾に以下を付加:

<!--APPLY{"action":"revise_slide","slideIndex":2,"instruction":"具体的な修正指示（例：タイトルのフォントサイズを大きく、背景色を青に変更）"}APPLY-->

### 重要なルール
- slideIndex は 0始まり（0 = 1枚目、1 = 2枚目...）
- ユーザーが明確に「〇枚目のスライドを△△にして」と言っている場合は、選択肢なしですぐに APPLY する
- 曖昧な要望（「全体的にもっと華やかに」等）は、まず OPTIONS で方向性を確認する
- APPLY の instruction には、AIがHTMLスライドを修正するための具体的な指示を書く
- テキスト部分で何を変更するか簡潔に説明してから、マーカーを付加する
- 1回の応答に OPTIONS と APPLY を両方含めない`;
  }

  // Step 6: 最終レビュー — アドバイスモード
  if (step === 6) {
    return `${basePrompt}

## 最終レビューモード

ユーザーは現在、デザイン化されたスライドの最終レビューを確認しています。

### あなたの役割
- デザインレビュー結果についてのユーザーの質問に回答する
- レイアウト、色使い、フォントなどのデザイン改善について相談にのる
- 修正の優先順位付けをサポートする
- レビューで指摘されたデザイン上の問題について具体的な改善案を提案する

### 注意事項
- この工程では直接的なスライド修正は行いません（修正はデザイン工程に戻って行います）
- ユーザーが「採用」「不採用」を判断するためのサポートに徹する
- デザインの修正が必要な場合は、デザイン工程に戻ることを提案する`;
  }

  return basePrompt;
}

/** Parse <!--APPLY{...}APPLY--> and persist changes to DB */
async function persistApplyChanges(
  supabase: SupabaseClient,
  projectId: string,
  step: number,
  text: string
): Promise<void> {
  if (step !== 2 && step !== 3) return;

  const match = text.match(/<!--APPLY([\s\S]*?)APPLY-->/);
  if (!match) return;

  try {
    const payload = JSON.parse(match[1]);

    // Get current structure ID
    const { data: structureData } = await supabase
      .from("structures")
      .select("id, pages")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!structureData) return;

    // Step 2: Structure changes
    if (step === 2) {
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
          `[project-chat] Applied structure changes for project ${projectId}`
        );
      }
    }

    // Step 3: Details (page_contents) changes
    if (step === 3) {
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
          `[project-chat] Applied details change for page ${revised.page_number} in project ${projectId}`
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
          `[project-chat] Applied details changes for ${pages.length} pages in project ${projectId}`
        );
      }
    }
  } catch (err) {
    console.error("[project-chat] Failed to persist APPLY changes:", err);
  }
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

      const fullMessages = convertToCoreMessages(body.messages || []);

      // Determine RAG query from last user message
      const lastUserMsg = fullMessages[fullMessages.length - 1];
      const ragQuery = lastUserMsg?.role === "user" ? lastUserMsg.content : "";

      // Load all pre-stream data in parallel for fast time-to-first-byte
      const stepContextLoader =
        step === 1
          ? loadResearchContext(supabase, projectId)
          : step === 2
            ? loadStructureContext(supabase, projectId)
            : step === 3
              ? loadDetailsContext(supabase, projectId)
              : step === 5
                ? loadDesignContext(supabase, projectId)
                : Promise.resolve("");

      const summariesLoader = Promise.resolve(
        supabase
          .from("project_chat_summaries")
          .select("step, summary")
          .eq("project_id", projectId)
          .lt("step", step)
          .order("step", { ascending: true })
      )
        .then(({ data }) =>
          (data || []).map(
            (r: { step: number; summary: string }) =>
              `### ${getStepName(r.step)}\n${r.summary}`
          )
        )
        .catch(() => [] as string[]);

      const ragLoader = ragQuery
        ? getTeamIdForUser(supabase, user.id).then((teamId) => {
            const chunkTypes =
              step === 5
                ? (["style", "expression", "correction"] as const)
                : step === 2 || step === 3
                  ? (["composition", "correction", "expression"] as const)
                  : (["correction", "expression"] as const);
            return buildRagContext({
              query: ragQuery,
              teamId,
              chunkTypes: [...chunkTypes],
              limit: 4,
              logContext: "project-chat",
            });
          })
        : Promise.resolve("");

      const [stepContext, summaries, ragContext] = await Promise.all([
        stepContextLoader,
        summariesLoader,
        ragLoader,
      ]);

      // Window messages to fit context
      const promptMessages = windowByText(fullMessages, (m) => m.content, {
        preserveHeadItems: 2,
        maxItems: 28,
        maxTotalChars: 22_000,
      });

      const systemPrompt = buildSystemPrompt(step, summaries, stepContext, ragContext);
      const promptChars =
        systemPrompt.length +
        promptMessages.reduce((sum, msg) => sum + msg.content.length, 0);

      const result = streamText({
        model: sonnet,
        system: systemPrompt,
        messages: promptMessages,
        async onFinish({ text, totalUsage }) {
          // Log AI usage
          await recordAiUsage({
            supabase,
            endpoint: "/api/ai/project-chat",
            operation: "streamText",
            model: "claude-sonnet-4-5-20250929",
            userId: user.id,
            projectId,
            metadata: { step },
            promptChars,
            completionChars: text.length,
            usage: totalUsage,
          });

          // Save user message (the last one) and assistant response
          const lastUserMsg = fullMessages[fullMessages.length - 1];
          if (lastUserMsg?.role === "user") {
            await supabase.from("project_chat_messages").insert({
              project_id: projectId,
              step,
              role: "user",
              content: lastUserMsg.content,
            });
          }

          await supabase.from("project_chat_messages").insert({
            project_id: projectId,
            step,
            role: "assistant",
            content: text,
          });

          // Persist APPLY changes to DB
          await persistApplyChanges(supabase, projectId, step, text);
        },
      });

      return result.toUIMessageStreamResponse();
    },
    {
      context: "project-chat",
      fallbackMessage: "チャット応答に失敗しました",
    }
  );
}
