"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProjectListActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        alert("複製に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      alert("複製に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDuplicate}
        disabled={loading}
        title="複製"
      >
        複製
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
        className="hover:bg-status-error-bg hover:text-status-error-text"
        title="削除"
      >
        削除
      </Button>
    </div>
  );
}
