"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAbortableAction } from "@/hooks/use-abortable-action";
import type {
  BriefSheetData,
  DiscussionChatMessage,
  DiscussionMode,
  SimpleDiscussionMessage,
} from "./types";
import { getMessageText } from "./utils";
import { ModeSelector } from "./components/mode-selector";
import { CoverageTracker } from "./components/coverage-tracker";
import { ToneSelector } from "./components/tone-selector";
import { SingleChatSection } from "./components/single-chat-section";
import { useDiscussionMode } from "./hooks/use-discussion-mode";
import { useBriefSheet } from "./hooks/use-brief-sheet";
import { BriefEditorPanel } from "./components/brief-editor-panel";

interface UploadedFile {
  id: string;
  file_name: string;
}

interface BrainstormExport {
  id: string;
  file_type: "md" | "docx";
  created_at: string;
  downloadUrl: string;
}

interface HandoffProject {
  id: string;
  title: string;
  output_type: "slide" | "document";
  created_at: string;
}

export default function BrainstormDetailPage() {
  const { brainstormId } = useParams<{ brainstormId: string }>();
  const { runWithTimeout } = useAbortableAction();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("新しいブレスト");
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "archived">("active");
  const [savingMeta, setSavingMeta] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const [exports, setExports] = useState<BrainstormExport[]>([]);
  const [projects, setProjects] = useState<HandoffProject[]>([]);
  const [savingBrief, setSavingBrief] = useState(false);
  const [exportingMd, setExportingMd] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [handingOff, setHandingOff] = useState(false);

  const [currentMode, setCurrentMode] = useState<DiscussionMode>("draw_out");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/discussion",
        body: { brainstormId, mode: currentMode },
      }),
    [brainstormId, currentMode]
  );

  const { messages, sendMessage, setMessages, status: chatStatus } = useChat({ transport });
  const isStreaming = chatStatus === "streaming" || chatStatus === "submitted";
  const chatMessages = messages as unknown as DiscussionChatMessage[];

  const { suggestedMode, coverageStatus, acceptSuggestion, dismissSuggestion } =
    useDiscussionMode({
      messages: chatMessages,
      currentMode,
      onModeChange: setCurrentMode,
    });

  const {
    briefSheet,
    setBriefSheet,
    generatingBrief,
    briefError,
    briefTone,
    setBriefTone,
    generateBriefSheet,
  } = useBriefSheet({
    brainstormId,
    messages: chatMessages,
    isStreaming,
    runWithTimeout,
  });

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/brainstorms/${brainstormId}`);
    if (!res.ok) return;

    const data = await res.json();
    if (data.session) {
      setTitle(data.session.title || "新しいブレスト");
      setClientName(data.session.client_name || "");
      setStatus(data.session.status || "active");
      if (
        data.session.brief_tone === "logical" ||
        data.session.brief_tone === "emotional" ||
        data.session.brief_tone === "hybrid"
      ) {
        setBriefTone(data.session.brief_tone);
      }

      const nextBrief: BriefSheetData = {
        client_info: data.session.client_info || "",
        background: data.session.background || "",
        hypothesis: data.session.hypothesis || "",
        goal: data.session.goal || "",
        constraints: data.session.constraints || "",
        research_topics: data.session.research_topics || "",
        structure_draft: data.session.structure_draft || "",
        raw_markdown: data.session.raw_markdown || "",
      };
      setBriefSheet(nextBrief);

      // チャット履歴を復元
      const history = data.session.chat_history;
      if (Array.isArray(history) && history.length > 0) {
        const restored = history.map(
          (msg: { role: string; content: string }, i: number) => ({
            id: `restored-${i}`,
            role: msg.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: msg.content }],
          })
        );
        setMessages(restored);
      }
    }

    setExports(
      (data.exports || []).map((item: { id: string; file_type: "md" | "docx"; created_at: string }) => ({
        ...item,
        downloadUrl: `/api/brainstorms/exports/download?id=${item.id}`,
      }))
    );
    setProjects(data.projects || []);
    setUploadedFiles(data.uploadedFiles || []);
  }, [brainstormId, setBriefSheet, setBriefTone, setMessages]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      await fetch(`/api/brainstorms/${brainstormId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, client_name: clientName, status, brief_tone: briefTone }),
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveBrief = async () => {
    if (!briefSheet) return;
    setSavingBrief(true);
    try {
      const res = await fetch(`/api/brainstorms/${brainstormId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief_tone: briefTone,
          client_info: briefSheet.client_info,
          background: briefSheet.background,
          hypothesis: briefSheet.hypothesis,
          goal: briefSheet.goal,
          constraints: briefSheet.constraints,
          research_topics: briefSheet.research_topics,
          structure_draft: briefSheet.structure_draft,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setBriefSheet({
            client_info: data.session.client_info || "",
            background: data.session.background || "",
            hypothesis: data.session.hypothesis || "",
            goal: data.session.goal || "",
            constraints: data.session.constraints || "",
            research_topics: data.session.research_topics || "",
            structure_draft: data.session.structure_draft || "",
            raw_markdown: data.session.raw_markdown || "",
          });
        }
      }
    } finally {
      setSavingBrief(false);
    }
  };

  const handleExport = async (fileType: "md" | "docx") => {
    if (fileType === "md") setExportingMd(true);
    if (fileType === "docx") setExportingDocx(true);
    try {
      const res = await fetch(`/api/brainstorms/${brainstormId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.export) {
        const next = {
          id: data.export.id,
          file_type: data.export.file_type,
          created_at: data.export.created_at,
          downloadUrl: data.downloadUrl,
        } as BrainstormExport;
        setExports((prev) => [next, ...prev]);
      }
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } finally {
      setExportingMd(false);
      setExportingDocx(false);
    }
  };

  const handleHandoff = async (outputType: "slide" | "document") => {
    setHandingOff(true);
    try {
      const res = await fetch(`/api/brainstorms/${brainstormId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputType }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) {
        setProjects((prev) => [data.project, ...prev]);
      }
      if (data.redirectTo) {
        window.open(data.redirectTo, "_blank");
      }
    } finally {
      setHandingOff(false);
    }
  };

  const handleComplete = async () => {
    await fetch(`/api/brainstorms/${brainstormId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    setStatus("completed");
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("brainstormId", brainstormId);
        const res = await fetch("/api/brainstorms/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) return;
        const result = await res.json();
        setUploadedFiles((prev) => [...prev, { id: result.id, file_name: result.fileName }]);
      } finally {
        setUploading(false);
      }
    },
    [brainstormId]
  );

  const handleFileDelete = useCallback(async (fileId: string) => {
    const res = await fetch("/api/brainstorms/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    if (res.ok) {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  }, []);

  const handleSend = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputValue.trim() || isStreaming) return;
      sendMessage({ text: inputValue });
      setInputValue("");
    },
    [inputValue, isStreaming, sendMessage]
  );

  const singleMessages = useMemo<SimpleDiscussionMessage[]>(
    () =>
      chatMessages.map((message) => ({
        id: message.id,
        role: message.role,
        text: getMessageText(message),
      })),
    [chatMessages]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-beige bg-white px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-sm font-bold text-navy">ブレインストーミング</h1>
          <span className="rounded-full bg-off-white px-2 py-0.5 text-[11px] text-text-secondary">
            {status === "completed" ? "完了" : status === "archived" ? "アーカイブ" : "進行中"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr,220px,200px,96px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-beige bg-off-white px-3 py-1.5 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
            placeholder="ブレストタイトル"
          />
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="rounded-md border border-beige bg-off-white px-3 py-1.5 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
            placeholder="クライアント名"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "completed" | "archived")}
            className="rounded-md border border-beige bg-off-white px-3 py-1.5 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          >
            <option value="active">進行中</option>
            <option value="completed">完了</option>
            <option value="archived">アーカイブ</option>
          </select>
          <button
            onClick={handleSaveMeta}
            disabled={savingMeta}
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
          >
            {savingMeta ? "保存中" : "保存"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <ModeSelector currentMode={currentMode} onChangeMode={setCurrentMode} />

          {currentMode === "draw_out" && (
            <CoverageTracker coverageStatus={coverageStatus} />
          )}

          {currentMode === "structure" && (
            <ToneSelector currentTone={briefTone} onChangeTone={setBriefTone} />
          )}

          <SingleChatSection
            messages={singleMessages}
            isStreaming={isStreaming}
            inputValue={inputValue}
            generatingBrief={generatingBrief}
            suggestedMode={suggestedMode}
            messagesEndRef={messagesEndRef}
            uploadedFiles={uploadedFiles}
            uploading={uploading}
            onInputChange={setInputValue}
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            onGenerateBriefSheet={() => generateBriefSheet()}
            onCompleteDiscussion={handleComplete}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
          />
        </div>

        <BriefEditorPanel
          briefSheet={briefSheet}
          briefError={briefError}
          saving={savingBrief}
          exportingMd={exportingMd}
          exportingDocx={exportingDocx}
          handingOff={handingOff}
          exports={exports}
          projects={projects}
          onChangeField={(field, value) => {
            if (field === "raw_markdown" || !briefSheet) return;
            setBriefSheet({ ...briefSheet, [field]: value });
          }}
          onSave={handleSaveBrief}
          onExport={handleExport}
          onHandoff={handleHandoff}
        />
      </div>
    </div>
  );
}
