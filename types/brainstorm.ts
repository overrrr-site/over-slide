import type { BriefSheetFields, BriefTone } from "@/lib/brief-sheet/format";

export type BrainstormStatus = "active" | "completed" | "archived";

export interface BrainstormSession extends BriefSheetFields {
  id: string;
  title: string;
  client_name: string;
  status: BrainstormStatus;
  brief_tone: BriefTone;
  raw_markdown: string;
  chat_history: Array<{ role: "user" | "assistant"; content: string }>;
  created_at: string;
  updated_at: string;
}

export interface BrainstormExport {
  id: string;
  brainstorm_id: string;
  file_type: "md" | "docx";
  created_at: string;
}

export interface BrainstormHandoffRequest {
  outputType: "slide" | "document";
  title?: string;
  clientName?: string;
}
