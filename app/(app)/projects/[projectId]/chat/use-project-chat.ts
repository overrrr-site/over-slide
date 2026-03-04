"use client";

import { createContext, useContext } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  step: number;
  createdAt: string;
  /** Parsed option cards from <!--OPTIONS--> markers */
  options?: ChatOption[];
  /** Whether options have been selected */
  optionsSelected?: boolean;
}

export interface ChatOption {
  id: string;
  label: string;
  description: string;
}

/** Payload from <!--APPLY--> markers */
export interface ApplyPayload {
  action: string;
  [key: string]: unknown;
}

export interface ProjectChatContextValue {
  /** All messages across steps (for display) */
  allMessages: ChatMessage[];
  /** Current step number */
  currentStep: number;
  /** Whether AI is streaming */
  isStreaming: boolean;
  /** Send a message */
  sendMessage: (text: string) => void;
  /** Chat panel open state */
  isPanelOpen: boolean;
  /** Toggle chat panel */
  togglePanel: () => void;
  /** Set panel open state */
  setPanelOpen: (open: boolean) => void;
  /** Register a callback for when AI applies changes */
  registerApplyHandler: (handler: (payload: ApplyPayload) => void) => void;
  /** Select an option from <!--OPTIONS--> */
  selectOption: (messageId: string, option: ChatOption) => void;
  /** Summarize current step's conversation before moving to next step */
  summarizeCurrentStep: () => Promise<void>;
}

export const ProjectChatContext = createContext<ProjectChatContextValue | null>(
  null
);

export function useProjectChat() {
  const ctx = useContext(ProjectChatContext);
  if (!ctx) {
    throw new Error("useProjectChat must be used within ProjectChatWrapper");
  }
  return ctx;
}
