"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Handle error silently
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.preventDefault()}
      >
        <span className="text-xs text-red-500 whitespace-nowrap">
          削除しますか？
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg px-2 py-0.5 text-xs bg-status-error-text text-white hover:bg-status-error-text/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
        >
          {deleting ? "..." : "はい"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg px-2 py-0.5 text-xs bg-status-draft-bg text-status-draft-text hover:bg-status-draft-bg/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
        >
          いいえ
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        setConfirming(true);
      }}
      className="rounded-lg p-1 text-text-secondary hover:text-status-error-text hover:bg-status-error-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
      title="資料作成を削除"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    </button>
  );
}
