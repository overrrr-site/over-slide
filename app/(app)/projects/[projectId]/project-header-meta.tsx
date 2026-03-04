"use client";

import { useState, useCallback } from "react";
import { Icon } from "@iconify/react";

interface Props {
  projectId: string;
  initialTitle: string;
  initialClientName: string;
}

export function ProjectHeaderMeta({ projectId, initialTitle, initialClientName }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [clientName, setClientName] = useState(initialClientName);
  const [saving, setSaving] = useState(false);

  // 表示用（保存済みの値）
  const [displayTitle, setDisplayTitle] = useState(initialTitle);
  const [displayClientName, setDisplayClientName] = useState(initialClientName);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, client_name: clientName }),
      });
      if (res.ok) {
        setDisplayTitle(title.trim() || "新しいプロジェクト");
        setDisplayClientName(clientName.trim());
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [clientName, projectId, title]);

  const handleCancel = useCallback(() => {
    setTitle(displayTitle);
    setClientName(displayClientName);
    setEditing(false);
  }, [displayTitle, displayClientName]);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-beige bg-off-white px-2 py-1 text-sm font-bold text-navy focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          placeholder="プロジェクト名"
          autoFocus
        />
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="rounded-md border border-beige bg-off-white px-2 py-1 text-xs text-text-secondary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          placeholder="クライアント名"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-navy px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {saving ? "..." : "保存"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="rounded-md border border-beige px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-off-white disabled:opacity-50"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <div>
        <h1 className="text-lg font-bold text-navy">{displayTitle}</h1>
        {displayClientName && (
          <p className="text-xs text-text-secondary">{displayClientName}</p>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-off-white hover:text-navy group-hover:opacity-100"
        title="タイトル・クライアント名を編集"
      >
        <Icon icon="mdi:pencil-outline" className="h-4 w-4" />
      </button>
    </div>
  );
}
