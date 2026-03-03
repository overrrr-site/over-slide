import type { SupabaseClient } from "@supabase/supabase-js";

interface StyleGuideRow {
  composition_patterns: { text: string } | null;
  tone: { text: string } | null;
  information_density: { text: string } | null;
  phrases: { text: string } | null;
  custom_rules: string[];
}

/**
 * ユーザーのスタイルガイドを取得し、AIプロンプト用のテキストに変換する。
 * データがない場合は空文字を返す（プリセットのINSERTは行わない）。
 */
export async function getStyleGuideContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("style_guide")
    .select(
      "composition_patterns, tone, information_density, phrases, custom_rules"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return "";

  return formatStyleGuide(data as StyleGuideRow);
}

function formatStyleGuide(guide: StyleGuideRow): string {
  const sections: string[] = [];

  sections.push("## レビュアーのスタイルガイド");

  if (guide.composition_patterns?.text) {
    sections.push(`### 構成パターン\n${guide.composition_patterns.text}`);
  }
  if (guide.tone?.text) {
    sections.push(`### 文体・トーン\n${guide.tone.text}`);
  }
  if (guide.information_density?.text) {
    sections.push(`### 情報密度\n${guide.information_density.text}`);
  }
  if (guide.phrases?.text) {
    sections.push(`### よく使うフレーズ（指摘パターン）\n${guide.phrases.text}`);
  }
  if (guide.custom_rules?.length > 0) {
    const rules = guide.custom_rules
      .map((r, i) => `${i + 1}. ${r}`)
      .join("\n");
    sections.push(`### レビュー優先順位\n${rules}`);
  }

  return sections.join("\n\n");
}
