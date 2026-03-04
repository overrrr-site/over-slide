"use client";

import type { ChatOption } from "./use-project-chat";

interface ChatOptionCardsProps {
  messageId: string;
  options: ChatOption[];
  selected: boolean;
  onSelect: (messageId: string, option: ChatOption) => void;
}

export function ChatOptionCards({
  messageId,
  options,
  selected,
  onSelect,
}: ChatOptionCardsProps) {
  return (
    <div className="flex gap-2 mt-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(messageId, option)}
          disabled={selected}
          className={`flex-1 rounded-lg border p-2 text-left transition-all ${
            selected
              ? "border-beige bg-off-white opacity-60 cursor-default"
              : "border-beige bg-white hover:border-green hover:bg-green/5 cursor-pointer"
          }`}
        >
          <div className="text-xs font-medium text-navy">{option.label}</div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {option.description}
          </div>
          {selected && (
            <div className="mt-1 flex items-center gap-1 text-xs text-green">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              選択済み
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
