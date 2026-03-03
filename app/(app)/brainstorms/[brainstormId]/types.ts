export interface BriefSheetData {
  client_info: string;
  background: string;
  hypothesis: string;
  goal: string;
  constraints: string;
  research_topics: string;
  structure_draft: string;
  raw_markdown: string;
}

export type DiscussionMode = "draw_out" | "challenge" | "expand" | "structure";

export type BriefSheetTone = "logical" | "emotional" | "hybrid";

export type CoverageItemKey =
  | "client_info"
  | "background"
  | "hypothesis"
  | "goal"
  | "constraints";

export type CoverageStatus = Record<CoverageItemKey, boolean>;

export interface SimpleDiscussionMessage {
  id: string;
  role: string;
  text: string;
  suggestedMode?: DiscussionMode | null;
}

export interface DiscussionMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface DiscussionChatMessage {
  id: string;
  role: string;
  parts: DiscussionMessagePart[];
}