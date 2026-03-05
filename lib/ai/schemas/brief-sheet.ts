import { z } from "zod";

export const briefSheetSchema = z.object({
  client_info: z.string().describe("クライアント情報"),
  background: z.string().describe("背景・課題"),
  hypothesis: z.string().describe("提案の方向性"),
  goal: z.string().describe("ゴール"),
  constraints: z.string().describe("制約条件"),
  research_topics: z.string().describe("リサーチで確認すべきこと"),
  structure_draft: z.string().describe("構成の骨格案"),
  raw_markdown: z.string().describe("ブリーフシート全文(Markdown)"),
  reasoning_chain: z.string().describe("結論に至った思考の流れ（議論の論理展開を時系列で記述）"),
  rejected_alternatives: z.string().describe("検討したが却下した選択肢とその理由"),
  key_expressions: z.string().describe("議論中に生まれた印象的な表現・フレーズ"),
  discussion_note: z.string().describe("議論全体を物語形式でまとめた要約"),
});

export type BriefSheet = z.infer<typeof briefSheetSchema>;
