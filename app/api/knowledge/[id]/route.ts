import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  // ドキュメント存在確認 & storage_path を取得
  const { data: doc, error: fetchErr } = await supabase
    .from("knowledge_docs")
    .select("id, storage_path")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) {
    return NextResponse.json(
      { error: "ドキュメントが見つかりません" },
      { status: 404 }
    );
  }

  // ストレージからファイルを削除（ベストエフォート）
  if (doc.storage_path) {
    try {
      await supabase.storage.from("uploads").remove([doc.storage_path]);
    } catch {
      // ストレージ削除失敗は致命的でない
    }
  }

  // ドキュメント削除（CASCADE で knowledge_chunks も自動削除）
  const { error: deleteErr } = await supabase
    .from("knowledge_docs")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[knowledge/delete] Error:", deleteErr);
    return NextResponse.json(
      { error: `削除に失敗しました: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
