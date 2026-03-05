export type BriefTone = "logical" | "emotional" | "hybrid";

export interface BriefSheetFields {
  client_info: string;
  background: string;
  hypothesis: string;
  goal: string;
  constraints: string;
  research_topics: string;
  structure_draft: string;
  reasoning_chain?: string;
  rejected_alternatives?: string;
  key_expressions?: string;
  discussion_note?: string;
}

export const EMPTY_BRIEF_FIELDS: BriefSheetFields = {
  client_info: "",
  background: "",
  hypothesis: "",
  goal: "",
  constraints: "",
  research_topics: "",
  structure_draft: "",
  reasoning_chain: "",
  rejected_alternatives: "",
  key_expressions: "",
  discussion_note: "",
};

function fallback(value: string): string {
  const trimmed = value?.trim();
  return trimmed || "（未定）";
}

export function buildBriefSheetMarkdown(fields: BriefSheetFields): string {
  let md = `■ ブリーフシート
──────────────────────────
クライアント：${fallback(fields.client_info)}
背景・課題：${fallback(fields.background)}
提案の方向性：${fallback(fields.hypothesis)}
ゴール：${fallback(fields.goal)}
制約条件：${fallback(fields.constraints)}
リサーチで確認すべきこと：${fallback(fields.research_topics)}
構成の骨格案：${fallback(fields.structure_draft)}`;

  if (fields.reasoning_chain?.trim()) {
    md += `\n思考の流れ：${fields.reasoning_chain.trim()}`;
  }
  if (fields.rejected_alternatives?.trim()) {
    md += `\n却下した選択肢：${fields.rejected_alternatives.trim()}`;
  }
  if (fields.key_expressions?.trim()) {
    md += `\nキーフレーズ：${fields.key_expressions.trim()}`;
  }
  if (fields.discussion_note?.trim()) {
    md += `\n議論ノート：${fields.discussion_note.trim()}`;
  }

  md += "\n──────────────────────────";
  return md;
}

export function normalizeBriefFields(
  data: Partial<BriefSheetFields> | null | undefined
): BriefSheetFields {
  return {
    client_info: data?.client_info || "",
    background: data?.background || "",
    hypothesis: data?.hypothesis || "",
    goal: data?.goal || "",
    constraints: data?.constraints || "",
    research_topics: data?.research_topics || "",
    structure_draft: data?.structure_draft || "",
    reasoning_chain: data?.reasoning_chain || "",
    rejected_alternatives: data?.rejected_alternatives || "",
    key_expressions: data?.key_expressions || "",
    discussion_note: data?.discussion_note || "",
  };
}
