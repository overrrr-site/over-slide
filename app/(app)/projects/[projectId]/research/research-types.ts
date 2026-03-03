import type { BriefSheetFields } from "@/lib/brief-sheet/format";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface MemoChatMessage {
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export interface AutonomousIteration {
  iteration: number;
  unresolvedIssues: string[];
  addedQueries: string[];
  addedSources: number;
}

export interface AutonomousSummary {
  stopReason: "resolved" | "max_iterations";
  remainingIssues: string[];
  iterations: AutonomousIteration[];
}

export type ActiveRequestMode = "generate" | "chat" | null;

export const BRIEF_FIELD_CONFIG: Array<{
  key: keyof BriefSheetFields;
  label: string;
  rows: number;
}> = [
  { key: "client_info", label: "クライアント", rows: 2 },
  { key: "background", label: "背景・課題", rows: 3 },
  { key: "hypothesis", label: "提案の方向性", rows: 3 },
  { key: "goal", label: "ゴール", rows: 2 },
  { key: "constraints", label: "制約条件", rows: 2 },
  { key: "research_topics", label: "リサーチで確認すべきこと", rows: 4 },
  { key: "structure_draft", label: "構成の骨格案", rows: 3 },
];
