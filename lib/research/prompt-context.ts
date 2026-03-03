import { dedupeSearchResults, sanitizeText, truncateForPrompt } from "./text-utils";

export interface PromptSearchResultInput {
  title?: string;
  url?: string;
  content?: string;
}

export interface PromptFileTextInput {
  name?: string;
  text?: string;
}

export interface PromptContextLimits {
  maxTotalChars: number;
  briefSheetChars: number;
  memoChars: number;
  instructionChars: number;
  keywordsChars: number;
  maxSearchItems: number;
  maxSearchSectionChars: number;
  maxSearchContentCharsPerItem: number;
  maxFileItems: number;
  maxFileSectionChars: number;
  maxFileTextCharsPerItem: number;
}

export interface PromptSectionResult {
  text: string;
  included: number;
  total: number;
}

type BuildPromptContextParams = {
  briefSheet: string;
  memo: string;
  instruction: string;
  keywords: string;
  searchResults: PromptSearchResultInput[];
  fileTexts: PromptFileTextInput[];
  limits: PromptContextLimits;
};

type BuildPromptContextResult = {
  context: string;
  briefSheetText: string;
  memoText: string;
  instructionText: string;
  keywordsText: string;
  searchSection: PromptSectionResult;
  fileSection: PromptSectionResult;
};

function buildSearchSection(
  results: PromptSearchResultInput[],
  limits: PromptContextLimits
): PromptSectionResult {
  const deduped = dedupeSearchResults(results);
  const limited = deduped.slice(0, limits.maxSearchItems);
  const entries: string[] = [];
  let usedChars = 0;

  for (const result of limited) {
    const title = truncateForPrompt(sanitizeText(result.title), 180) || "無題";
    const url = sanitizeText(result.url) || "不明";
    const content = truncateForPrompt(
      sanitizeText(result.content),
      limits.maxSearchContentCharsPerItem
    );

    const entry = `### ${title}\n${content}\n出典: ${url}`;
    if (usedChars + entry.length > limits.maxSearchSectionChars && entries.length > 0) {
      break;
    }

    entries.push(entry);
    usedChars += entry.length + 2;
  }

  const omitted = deduped.length - entries.length;
  const note = omitted > 0 ? `\n\n※ 検索結果は ${omitted} 件省略` : "";

  return {
    text: entries.join("\n\n") + note,
    included: entries.length,
    total: deduped.length,
  };
}

function buildFileSection(
  files: PromptFileTextInput[],
  limits: PromptContextLimits
): PromptSectionResult {
  const normalized = files
    .map((file) => ({
      name: sanitizeText(file.name),
      text: sanitizeText(file.text),
    }))
    .filter((file) => file.text);

  const limited = normalized.slice(0, limits.maxFileItems);
  const entries: string[] = [];
  let usedChars = 0;

  for (const file of limited) {
    const name = truncateForPrompt(file.name || "資料", 180);
    const body = truncateForPrompt(file.text, limits.maxFileTextCharsPerItem);
    const entry = `### ${name}\n${body}`;
    if (usedChars + entry.length > limits.maxFileSectionChars && entries.length > 0) {
      break;
    }

    entries.push(entry);
    usedChars += entry.length + 2;
  }

  const omitted = normalized.length - entries.length;
  const note = omitted > 0 ? `\n\n※ アップロード資料は ${omitted} 件省略` : "";

  return {
    text: entries.join("\n\n") + note,
    included: entries.length,
    total: normalized.length,
  };
}

export function buildResearchPromptContext(
  params: BuildPromptContextParams
): BuildPromptContextResult {
  const { limits } = params;

  const briefSheetText = truncateForPrompt(
    sanitizeText(params.briefSheet),
    limits.briefSheetChars
  );
  const memoText = truncateForPrompt(sanitizeText(params.memo), limits.memoChars);
  const instructionText = truncateForPrompt(
    sanitizeText(params.instruction),
    limits.instructionChars
  );
  const keywordsText = truncateForPrompt(
    sanitizeText(params.keywords),
    limits.keywordsChars
  );

  const searchSection = buildSearchSection(params.searchResults, limits);
  const fileSection = buildFileSection(params.fileTexts, limits);

  const contextParts: string[] = [`## ブリーフシート\n${briefSheetText || "（未入力）"}`];

  if (memoText) {
    contextParts.push(`## 既存のリサーチメモ\n${memoText}`);
  }

  if (instructionText) {
    contextParts.push(`## 追加指示\n${instructionText}`);
  }

  if (keywordsText) {
    contextParts.push(`## 追加キーワード\n${keywordsText}`);
  }

  if (searchSection.text) {
    contextParts.push(`## Web検索結果\n${searchSection.text}`);
  }

  if (fileSection.text) {
    contextParts.push(`## アップロード資料\n${fileSection.text}`);
  }

  const rawContext = contextParts.join("\n\n");
  const context =
    rawContext.length > limits.maxTotalChars
      ? `${rawContext.slice(0, limits.maxTotalChars)}\n\n※ 入力サイズ上限のため末尾を省略`
      : rawContext;

  return {
    context,
    briefSheetText,
    memoText,
    instructionText,
    keywordsText,
    searchSection,
    fileSection,
  };
}
