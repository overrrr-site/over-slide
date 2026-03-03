import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const APPLY_MODE = process.argv.includes("--apply");
const PAGE_SIZE = 500;
const PREVIEW_LIMIT = 5;

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function loadTopicQueryHelpers() {
  const sourcePath = resolve(process.cwd(), "lib/research/topic-queries.ts");
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const moduleObj = { exports: {} };
  const execute = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    transpiled
  );
  execute(
    moduleObj.exports,
    () => {
      throw new Error("require() is not supported in this script context");
    },
    moduleObj,
    sourcePath,
    dirname(sourcePath)
  );

  return moduleObj.exports;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractQueriesFromKeywords(text) {
  const seen = new Set();
  const queries = [];
  for (const line of text.split("\n")) {
    const query = line.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    queries.push(query);
  }
  return queries;
}

function normalizeStoredQueryArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const row of value) {
    if (typeof row !== "string") continue;
    const query = row.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    normalized.push(query);
  }
  return normalized;
}

async function fetchAllResearchMemos() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("research_memos")
      .select("id, project_id, theme_keywords, search_queries")
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function run() {
  const { normalizeKeywordTextToQueries } = loadTopicQueryHelpers();
  if (typeof normalizeKeywordTextToQueries !== "function") {
    throw new Error("normalizeKeywordTextToQueries could not be loaded");
  }

  const rows = await fetchAllResearchMemos();
  console.log(`Loaded research_memos: ${rows.length}`);

  const updates = [];

  for (const row of rows) {
    const beforeKeywords = normalizeText(row.theme_keywords);
    const afterKeywords = normalizeKeywordTextToQueries(beforeKeywords);
    const beforeQueries = normalizeStoredQueryArray(row.search_queries);
    const afterQueries = extractQueriesFromKeywords(afterKeywords);

    const keywordsChanged = beforeKeywords !== afterKeywords;
    const queriesChanged =
      JSON.stringify(beforeQueries) !== JSON.stringify(afterQueries);

    if (!keywordsChanged && !queriesChanged) continue;

    updates.push({
      id: row.id,
      projectId: row.project_id,
      beforeKeywords,
      afterKeywords,
      afterQueries,
    });
  }

  console.log(`Rows requiring update: ${updates.length}`);

  if (updates.length > 0) {
    console.log(`Preview (up to ${PREVIEW_LIMIT} rows):`);
    for (const item of updates.slice(0, PREVIEW_LIMIT)) {
      console.log(`- project_id=${item.projectId}`);
      console.log(`  before: ${item.beforeKeywords || "(empty)"}`);
      console.log(`  after : ${item.afterKeywords || "(empty)"}`);
    }
  }

  if (!APPLY_MODE) {
    console.log("\nDry-run only. Apply with:");
    console.log("  node scripts/normalize-research-keywords.mjs --apply");
    return;
  }

  if (updates.length === 0) {
    console.log("No updates needed.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const item of updates) {
    const { error } = await supabase
      .from("research_memos")
      .update({
        theme_keywords: item.afterKeywords,
        search_queries: item.afterQueries,
      })
      .eq("id", item.id);

    if (error) {
      errorCount += 1;
      console.error(
        `Failed to update project_id=${item.projectId}: ${error.message}`
      );
      continue;
    }
    successCount += 1;
  }

  console.log(`Update complete. success=${successCount}, failed=${errorCount}`);
  if (errorCount > 0) process.exit(1);
}

run().catch((error) => {
  console.error("normalize-research-keywords failed:", error);
  process.exit(1);
});
