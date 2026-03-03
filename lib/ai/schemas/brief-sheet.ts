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
});

export type BriefSheet = z.infer<typeof briefSheetSchema>;
