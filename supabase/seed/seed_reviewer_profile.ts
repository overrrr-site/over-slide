/**
 * Seed script: レビュアープロファイルを knowledge_docs / knowledge_chunks に登録する。
 *
 * 実行方法:
 *   npx ts-node supabase/seed/seed_reviewer_profile.ts
 *
 * 必要な環境変数:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// 環境変数
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error(
    "必要な環境変数が設定されていません: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// OpenAI Embedding (text-embedding-3-large, 1024 次元)
// ---------------------------------------------------------------------------
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: texts,
      dimensions: 1024,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI Embedding error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  // data.data は { index, embedding }[] — index 順にソート
  const sorted = (data.data as { index: number; embedding: number[] }[]).sort(
    (a, b) => a.index - b.index
  );
  return sorted.map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Markdown をセクション単位に分割
// ---------------------------------------------------------------------------
function splitBySection(markdown: string): { heading: string; body: string }[] {
  const lines = markdown.split("\n");
  const sections: { heading: string; body: string }[] = [];

  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // 前のセクションを保存
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = line.replace(/^## /, "").trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // 最後のセクションを保存
  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
async function main() {
  console.log("レビュアープロファイルの seed を開始します...");

  // 1. Markdown ファイルを読み込む
  const mdPath = join(__dirname, "reviewer_profile.md");
  const markdown = readFileSync(mdPath, "utf-8");
  console.log(`  ファイル読み込み完了: ${mdPath}`);

  // 2. セクション分割
  const sections = splitBySection(markdown);
  console.log(`  セクション数: ${sections.length}`);

  // 3. knowledge_docs を upsert（file_name で重複判定）
  const docFields = {
    title: "レビュアープロファイル（初期版）",
    file_name: "reviewer_profile.md",
    storage_path: "seed/reviewer_profile.md",
    doc_type: "markdown" as const,
    purpose: "content" as const,
    tags: ["レビュー基準", "判断軸"],
    analysis_status: "completed" as const,
  };

  // まず既存レコードを検索
  const { data: existingDoc } = await supabase
    .from("knowledge_docs")
    .select("id")
    .eq("file_name", docFields.file_name)
    .eq("storage_path", docFields.storage_path)
    .maybeSingle();

  let docId: string;

  if (existingDoc) {
    // 既存レコードを更新
    const { error: updateError } = await supabase
      .from("knowledge_docs")
      .update({
        ...docFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDoc.id);

    if (updateError) {
      throw new Error(`knowledge_docs 更新に失敗: ${updateError.message}`);
    }
    docId = existingDoc.id;
    console.log(`  knowledge_docs 更新完了 (id: ${docId})`);
  } else {
    // 新規挿入 — uploaded_by と team_id が必要
    // seed スクリプトでは service_role を使っているため、
    // 最初の admin ユーザーを取得して使う
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (profileError || !adminProfile) {
      throw new Error(
        "admin プロファイルが見つかりません。先にユーザーを作成してください。"
      );
    }

    const { data: newDoc, error: insertError } = await supabase
      .from("knowledge_docs")
      .insert({
        ...docFields,
        team_id: adminProfile.team_id,
        uploaded_by: adminProfile.id,
      })
      .select("id")
      .single();

    if (insertError || !newDoc) {
      throw new Error(`knowledge_docs 挿入に失敗: ${insertError?.message}`);
    }
    docId = newDoc.id;
    console.log(`  knowledge_docs 挿入完了 (id: ${docId})`);
  }

  // 4. 既存チャンクを削除
  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("doc_id", docId);

  if (deleteError) {
    throw new Error(`既存チャンク削除に失敗: ${deleteError.message}`);
  }

  // 5. セクションごとに embedding を生成
  const chunkTexts = sections.map(
    (s) => `${s.heading}\n${s.body}`
  );
  console.log("  embedding 生成中...");
  const embeddings = await generateEmbeddings(chunkTexts);
  console.log(`  embedding 生成完了 (${embeddings.length} 件)`);

  // 6. knowledge_chunks を挿入
  const chunkRows = sections.map((section, i) => ({
    doc_id: docId,
    chunk_type: "reviewer_profile" as const,
    content: `${section.heading}\n${section.body}`,
    metadata: {
      purpose: "content",
      tags: ["レビュー基準", "判断軸"],
      section_heading: section.heading,
    },
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error: chunkInsertError } = await supabase
    .from("knowledge_chunks")
    .insert(chunkRows);

  if (chunkInsertError) {
    throw new Error(`チャンク挿入に失敗: ${chunkInsertError.message}`);
  }

  console.log(`  knowledge_chunks 挿入完了 (${chunkRows.length} 件)`);
  console.log("seed 完了!");
}

main().catch((err) => {
  console.error("seed エラー:", err);
  process.exit(1);
});
