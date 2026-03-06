/**
 * Shared context loaders used by both project-chat and leader-chat routes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";

/** Load research memo + brief summary for step 1 */
export async function loadResearchContext(
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
      .select(
        "client_info, background, hypothesis, goal, constraints, research_topics"
      )
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
    const truncated =
      memo.length > 3000 ? memo.slice(0, 3000) + "\n...（以下省略）" : memo;
    parts.push(`### 現在のリサーチメモ\n${truncated}`);
  }

  return parts.join("\n\n");
}

/** Load current structure pages for step 2 */
export async function loadStructureContext(
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
export async function loadDetailsContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
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
export async function loadDesignContext(
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

  const metadata = slideData.slides.map((s, i) => ({
    slideIndex: i,
    slideType: s.slideType,
    title: s.title,
  }));
  return compactJsonForPrompt(metadata);
}

/** Load brief sheet as a compact summary (for leader context) */
export async function loadBriefContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<string> {
  const { data } = await supabase
    .from("brief_sheets")
    .select(
      "client_info, background, hypothesis, goal, constraints, research_topics, direction, key_expressions"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return "";

  const fields = [
    data.client_info && `クライアント: ${data.client_info}`,
    data.background && `背景・課題: ${data.background}`,
    data.hypothesis && `提案の方向性: ${data.hypothesis}`,
    data.goal && `ゴール: ${data.goal}`,
    data.constraints && `制約条件: ${data.constraints}`,
    data.research_topics && `調査テーマ: ${data.research_topics}`,
    data.direction && `方向性: ${data.direction}`,
    data.key_expressions && `キー表現: ${data.key_expressions}`,
  ].filter(Boolean);

  return fields.join("\n");
}
