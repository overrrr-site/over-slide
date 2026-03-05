export interface PendingIssuesParseResult {
  issues: string[];
  sectionFound: boolean;
  rawSection: string;
}

export interface EvidenceGap {
  /** マーカー内のラベル（例: "直接ヒアリング必須"、"要Web検索"） */
  marker: string;
  /** マーカーの前後50字程度の文脈 */
  context: string;
  /** Web検索で解消を試みるべきか */
  webSearchable: boolean;
}

export interface AllUnresolvedResult {
  pendingIssues: string[];
  evidenceGaps: EvidenceGap[];
  webSearchableGaps: EvidenceGap[];
  totalCount: number;
}

const NONE_PATTERNS = [
  /^なし[。.]?$/,
  /^特になし[。.]?$/,
  /^該当なし[。.]?$/,
  /^現時点でなし[。.]?$/,
  /^ありません[。.]?$/,
  /^無し[。.]?$/,
];

function isNoneValue(value: string): boolean {
  return NONE_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeIssueLine(line: string): string {
  return line
    .trim()
    .replace(/^>\s*/, "")
    .replace(/^\s*(?:[-*・]|\d+[.)、．])\s*/, "")
    .trim();
}

/**
 * リサーチメモの「未確認」セクションから未解決論点を抽出する。
 */
export function extractPendingIssues(markdown: string): PendingIssuesParseResult {
  const sectionMatch = markdown.match(
    /##\s*未確認\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/
  );

  if (!sectionMatch) {
    return {
      issues: [],
      sectionFound: false,
      rawSection: "",
    };
  }

  const rawSection = sectionMatch[1]?.trim() || "";
  const issues: string[] = [];
  const seen = new Set<string>();
  let inCodeBlock = false;

  for (const rawLine of rawSection.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const normalized = normalizeIssueLine(line);
    if (!normalized || isNoneValue(normalized)) continue;

    if (!seen.has(normalized)) {
      seen.add(normalized);
      issues.push(normalized);
    }
  }

  return {
    issues,
    sectionFound: true,
    rawSection,
  };
}

/**
 * 「要ヒアリング」系のマーカーかどうかを判定する。
 * これらはWeb検索では解消できないため、自走リサーチの対象外とする。
 */
const HUMAN_REQUIRED_PATTERNS = [
  /ヒアリング/,
  /直接確認/,
  /直接接触/,
  /要確認/,
  /問い合わせ/,
];

function isHumanRequired(marker: string): boolean {
  return HUMAN_REQUIRED_PATTERNS.some((pattern) => pattern.test(marker));
}

/**
 * メモ本文全体から【根拠不足...】マーカーを抽出する。
 * 「未確認」セクション内のマーカーは除外する（重複防止）。
 */
export function extractEvidenceGaps(markdown: string): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  const seen = new Set<string>();

  // 「未確認」セクションの範囲を特定して除外する
  const sectionMatch = markdown.match(
    /##\s*未確認\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/
  );
  const sectionStart = sectionMatch?.index ?? -1;
  const sectionEnd =
    sectionStart >= 0
      ? sectionStart + (sectionMatch?.[0]?.length ?? 0)
      : -1;

  // 【根拠不足】 or 【根拠不足:ラベル】 パターンを全文から検索
  const pattern = /【根拠不足(?::([^】]*))?】/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const matchIndex = match.index;

    // 「未確認」セクション内のマーカーはスキップ
    if (sectionStart >= 0 && matchIndex >= sectionStart && matchIndex < sectionEnd) {
      continue;
    }

    const markerLabel = match[1]?.trim() || "";
    // 前後50字の文脈を取得
    const contextStart = Math.max(0, matchIndex - 50);
    const contextEnd = Math.min(markdown.length, matchIndex + match[0].length + 50);
    const context = markdown
      .slice(contextStart, contextEnd)
      .replace(/\n/g, " ")
      .trim();

    const dedupeKey = markerLabel || context.slice(0, 60);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    gaps.push({
      marker: markerLabel,
      context,
      webSearchable: !isHumanRequired(markerLabel),
    });
  }

  return gaps;
}

/**
 * 「未確認」と本文中の【根拠不足】マーカーを合算して返す。
 * 自走リサーチの停止判定に使う。
 */
export function extractAllUnresolved(markdown: string): AllUnresolvedResult {
  const pending = extractPendingIssues(markdown);
  const gaps = extractEvidenceGaps(markdown);
  const webSearchableGaps = gaps.filter((g) => g.webSearchable);

  return {
    pendingIssues: pending.issues,
    evidenceGaps: gaps,
    webSearchableGaps,
    totalCount: pending.issues.length + webSearchableGaps.length,
  };
}
