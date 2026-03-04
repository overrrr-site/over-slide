/**
 * リサーチメモのセクション分割＆マージユーティリティ
 *
 * チャットからの修正指示で「変更セクションだけ」を受け取り、
 * 既存メモの該当セクションだけを差し替える。
 */

export interface MemoSection {
  /** セクション見出し（例: "エグゼクティブサマリー"）。先頭テキストの場合は空文字 */
  header: string;
  /** 見出し行を含むセクション全体のテキスト */
  body: string;
}

/**
 * メモを `## ` 見出しで区切り、セクション配列に分割する。
 *
 * - `# リサーチメモ` のような h1 行は最初のセクション body に含まれる
 * - 見出しの前にあるテキスト（preamble）は header="" として返す
 */
export function parseMemoSections(memo: string): MemoSection[] {
  if (!memo.trim()) return [];

  const sections: MemoSection[] = [];
  const lines = memo.split("\n");
  let currentHeader = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    // ## で始まる行（### は含めない — ## のみ対象）
    if (/^## /.test(line)) {
      // 今まで溜まっていた行をセクションとして保存
      if (currentLines.length > 0 || currentHeader) {
        sections.push({
          header: currentHeader,
          body: currentLines.join("\n"),
        });
      }
      currentHeader = line.replace(/^## /, "").trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // 最後のセクション
  if (currentLines.length > 0 || currentHeader) {
    sections.push({
      header: currentHeader,
      body: currentLines.join("\n"),
    });
  }

  return sections;
}

/**
 * 既存メモに部分更新をマージして返す。
 *
 * - partialUpdate に含まれるセクションで既存メモの同名セクションを置き換え
 * - partialUpdate に含まれないセクションはそのまま保持
 * - 既存メモに無いセクション名が来たら末尾に追加
 */
export function mergeMemoSections(
  existingMemo: string,
  partialUpdate: string,
): string {
  if (!partialUpdate.trim()) return existingMemo;
  if (!existingMemo.trim()) return partialUpdate;

  const existingSections = parseMemoSections(existingMemo);
  const updateSections = parseMemoSections(partialUpdate);

  // 更新セクションのうちヘッダー付きのものだけ取り出す
  const headerUpdates = updateSections.filter((s) => s.header);

  if (headerUpdates.length === 0) {
    // ヘッダー付きセクションが無い場合は部分更新として扱えない
    // → そのまま返す（フォールバック）
    return existingMemo;
  }

  // 既存セクションを複製して差し替える
  const merged = existingSections.map((existing) => {
    if (!existing.header) return existing; // preamble はそのまま

    const update = headerUpdates.find((u) => u.header === existing.header);
    if (update) {
      return update;
    }
    return existing;
  });

  // 既存に無い新セクションを末尾に追加
  for (const update of headerUpdates) {
    const exists = existingSections.some((e) => e.header === update.header);
    if (!exists) {
      merged.push(update);
    }
  }

  // 結合して返す
  return merged.map((s) => s.body).join("\n\n");
}
