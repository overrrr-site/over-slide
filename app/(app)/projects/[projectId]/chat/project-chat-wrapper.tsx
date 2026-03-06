"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createClient } from "@/lib/supabase/client";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import {
  ProjectChatContext,
  type ChatMessage,
  type ChatOption,
  type ApplyPayload,
} from "./use-project-chat";
import { ProjectChatPanel } from "./project-chat-panel";
import { ResizableHandle } from "./resizable-handle";

const LEADER_STEP = 0;

/** Derive step number from current URL path */
function useCurrentStep(): number {
  const pathname = usePathname();
  for (const s of WORKFLOW_STEPS) {
    if (pathname.includes(`/${s.path}`)) return s.id;
  }
  return 1;
}

function getStepPath(step: number): string {
  return WORKFLOW_STEPS.find((s) => s.id === step)?.path || "research";
}

const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_RATIO = 0.6;
const PANEL_DEFAULT_WIDTH = 380;
const STORAGE_KEY = "overwork-chat-panel-width";

/** Parse <!--OPTIONS{...}OPTIONS--> from text */
function parseOptions(text: string): { cleanText: string; options: ChatOption[] | null } {
  const match = text.match(/<!--OPTIONS([\s\S]*?)OPTIONS-->/);
  if (!match) return { cleanText: text, options: null };

  try {
    const parsed = JSON.parse(match[1]);
    const options = (parsed.options || []) as ChatOption[];
    const cleanText = text.replace(/<!--OPTIONS[\s\S]*?OPTIONS-->/, "").trim();
    return { cleanText, options };
  } catch {
    return { cleanText: text, options: null };
  }
}

/** Parse <!--APPLY{...}APPLY--> from text */
function parseApply(text: string): { cleanText: string; payload: ApplyPayload | null } {
  const match = text.match(/<!--APPLY([\s\S]*?)APPLY-->/);
  if (!match) return { cleanText: text, payload: null };

  try {
    const payload = JSON.parse(match[1]) as ApplyPayload;
    const cleanText = text.replace(/<!--APPLY[\s\S]*?APPLY-->/, "").trim();
    return { cleanText, payload };
  } catch {
    return { cleanText: text, payload: null };
  }
}

/** Parse <!--DISPLAY{...}DISPLAY--> from text */
function parseDisplay(text: string): { cleanText: string; displayStep: number | null } {
  const match = text.match(/<!--DISPLAY([\s\S]*?)DISPLAY-->/);
  if (!match) return { cleanText: text, displayStep: null };

  try {
    const parsed = JSON.parse(match[1]);
    const cleanText = text.replace(/<!--DISPLAY[\s\S]*?DISPLAY-->/, "").trim();
    return { cleanText, displayStep: parsed.step as number };
  } catch {
    return { cleanText: text, displayStep: null };
  }
}

export function ProjectChatWrapper({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const currentStep = useCurrentStep();
  const router = useRouter();

  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);

  // Restore panel width from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPanelWidth(Math.max(PANEL_MIN_WIDTH, parseInt(saved, 10)));
    }
  }, []);

  // Save panel width to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  // Apply handler registered by step pages
  const applyHandlerRef = useRef<((payload: ApplyPayload) => void) | null>(null);
  const pendingApplyRef = useRef<ApplyPayload | null>(null);

  const registerApplyHandler = useCallback(
    (handler: (payload: ApplyPayload) => void) => {
      applyHandlerRef.current = handler;
      // Fire pending apply if there's one waiting after a DISPLAY navigation
      if (pendingApplyRef.current) {
        handler(pendingApplyRef.current);
        pendingApplyRef.current = null;
      }
    },
    []
  );

  // Track which option sets have been selected (by message ID)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Chat messages from DB (leader messages: step=0)
  const [dbMessages, setDbMessages] = useState<ChatMessage[]>([]);

  // Load leader messages from DB
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("project_chat_messages")
        .select("id, step, role, content, metadata, created_at")
        .eq("project_id", projectId)
        .eq("step", LEADER_STEP)
        .order("created_at", { ascending: true });

      if (data) {
        setDbMessages(
          data.map((row) => ({
            id: row.id,
            role: row.role as "user" | "assistant",
            content: row.content,
            step: LEADER_STEP,
            createdAt: row.created_at,
          }))
        );
      }
    };
    load();
  }, [projectId]);

  // useChat for leader (single instance, not per-step)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/leader-chat",
        body: { projectId, currentDisplayStep: currentStep },
      }),
    [projectId, currentStep]
  );

  const {
    messages: streamMessages,
    sendMessage: chatSend,
    status,
    setMessages,
  } = useChat({
    transport,
    id: `leader-chat-${projectId}`,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Initialize useChat messages from DB on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (dbMessages.length > 0) {
      initializedRef.current = true;
      setMessages(
        dbMessages.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: new Date(m.createdAt),
        }))
      );
    }
  }, [dbMessages, setMessages]);

  // Detect <!--APPLY--> and <!--DISPLAY--> in completed messages
  const processedMarkersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isStreaming) return;
    for (const m of streamMessages) {
      if (m.role !== "assistant") continue;
      if (processedMarkersRef.current.has(m.id)) continue;

      const text = m.parts
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("");

      // Check for DISPLAY marker
      const { displayStep } = parseDisplay(text);
      if (displayStep && displayStep !== currentStep) {
        router.push(`/projects/${projectId}/${getStepPath(displayStep)}`);
      }

      // Check for APPLY marker
      const { payload } = parseApply(text);
      if (payload) {
        processedMarkersRef.current.add(m.id);
        const targetStep = payload.target_step || currentStep;

        if (targetStep === currentStep && applyHandlerRef.current) {
          // Current step page can handle it
          applyHandlerRef.current(payload);
        } else if (targetStep !== currentStep) {
          // Navigate first, then apply when handler is registered
          pendingApplyRef.current = payload;
          router.push(`/projects/${projectId}/${getStepPath(targetStep)}`);
        }
      } else {
        // Mark as processed even without APPLY (to avoid re-processing DISPLAY)
        processedMarkersRef.current.add(m.id);
      }
    }
  }, [streamMessages, isStreaming, currentStep, projectId, router]);

  // Build allMessages for display
  const allMessages = useMemo(() => {
    const result: ChatMessage[] = [];

    for (const m of streamMessages) {
      const rawText = m.parts
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("");
      if (!rawText.trim()) continue;

      // Parse and strip all markers
      const { cleanText: afterOptions, options } = parseOptions(rawText);
      const { cleanText: afterApply } = parseApply(afterOptions);
      const { cleanText } = parseDisplay(afterApply);

      const msg: ChatMessage = {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: cleanText,
        step: LEADER_STEP,
        createdAt: new Date().toISOString(),
      };

      if (options && options.length > 0) {
        msg.options = options;
        msg.optionsSelected = !!selectedOptions[m.id];
      }

      result.push(msg);
    }

    return result;
  }, [streamMessages, selectedOptions]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      chatSend({ text });
    },
    [chatSend, isStreaming]
  );

  const selectOption = useCallback(
    (messageId: string, option: ChatOption) => {
      setSelectedOptions((prev) => ({ ...prev, [messageId]: option.id }));
      chatSend({ text: `「${option.label}」を選択します。この方向で進めてください。` });
    },
    [chatSend]
  );

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  // Summarize is still available for step pages that call it
  const summarizeCurrentStep = useCallback(async () => {
    const hasMessages = streamMessages.some(
      (m) => m.role === "assistant" || m.role === "user"
    );
    if (!hasMessages) return;

    try {
      await fetch("/api/ai/project-chat/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, step: currentStep }),
      });
    } catch (err) {
      console.error("[chat] Failed to summarize step:", err);
    }
  }, [projectId, currentStep, streamMessages]);

  const ctxValue = useMemo(
    () => ({
      allMessages,
      currentStep,
      isStreaming,
      sendMessage,
      isPanelOpen,
      togglePanel,
      setPanelOpen: setIsPanelOpen,
      registerApplyHandler,
      selectOption,
      summarizeCurrentStep,
    }),
    [allMessages, currentStep, isStreaming, sendMessage, isPanelOpen, togglePanel, registerApplyHandler, selectOption, summarizeCurrentStep]
  );

  // Resize handler
  const handleResize = useCallback((delta: number) => {
    setPanelWidth((prev) => {
      const maxWidth = typeof window !== "undefined"
        ? window.innerWidth * PANEL_MAX_RATIO
        : 600;
      return Math.max(PANEL_MIN_WIDTH, Math.min(maxWidth, prev - delta));
    });
  }, []);

  return (
    <ProjectChatContext.Provider value={ctxValue}>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">{children}</div>
        {isPanelOpen && (
          <>
            <ResizableHandle onResize={handleResize} />
            <div
              className="flex-shrink-0 overflow-hidden border-l border-beige"
              style={{ width: panelWidth }}
              suppressHydrationWarning
            >
              <ProjectChatPanel />
            </div>
          </>
        )}
        {!isPanelOpen && (
          <button
            onClick={togglePanel}
            className="flex-shrink-0 flex items-center justify-center w-10 border-l border-beige bg-white hover:bg-off-white transition-colors"
            title="AI編集チャットを開く"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-navy"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}
      </div>
    </ProjectChatContext.Provider>
  );
}
