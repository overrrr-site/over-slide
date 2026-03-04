"use client";

import { useProjectChat } from "./use-project-chat";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";

export function ProjectChatPanel() {
  const { allMessages, isStreaming, sendMessage, togglePanel, currentStep } =
    useProjectChat();

  return (
    <div className="flex h-full flex-col bg-off-white/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-beige bg-white px-3 py-2">
        <h3 className="text-sm font-bold text-navy">AI編集チャット</h3>
        <button
          onClick={togglePanel}
          className="rounded p-1 text-text-secondary hover:bg-off-white hover:text-navy transition-colors"
          title="チャットを閉じる"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <ChatMessageList messages={allMessages} isStreaming={isStreaming} currentStep={currentStep} />

      {/* Input */}
      <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
    </div>
  );
}
