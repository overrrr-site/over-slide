export type BriefTone = "logical" | "emotional" | "hybrid";

export interface BriefSheetFields {
  client_info: string;
  background: string;
  hypothesis: string;
  goal: string;
  constraints: string;
  research_topics: string;
  structure_draft: string;
}

export const EMPTY_BRIEF_FIELDS: BriefSheetFields = {
  client_info: "",
  background: "",
  hypothesis: "",
  goal: "",
  constraints: "",
  research_topics: "",
  structure_draft: "",
};

function fallback(value: string): string {
  const trimmed = value?.trim();
  return trimmed || "（未定）";
}

export function buildBriefSheetMarkdown(fields: BriefSheetFields): string {
  return `■ ブリーフシート
──────────────────────────
クライアント：${fallback(fields.client_info)}
背景・課題：${fallback(fields.background)}
提案の方向性：${fallback(fields.hypothesis)}
ゴール：${fallback(fields.goal)}
制約条件：${fallback(fields.constraints)}
リサーチで確認すべきこと：${fallback(fields.research_topics)}
構成の骨格案：${fallback(fields.structure_draft)}
──────────────────────────`;
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
  };
}
