"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BrainstormActions({ brainstormId }: { brainstormId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("このブレストを削除しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brainstorms/${brainstormId}`, {
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
  );
}
