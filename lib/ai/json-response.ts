/** マークダウンのコードブロック記号を除去する */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "");
}

/**
 * JSON文字列の中身を1文字ずつ辿り、
 * エスケープされていない改行・タブなどを正しくエスケープする。
 */
function escapeStringContents(json: string): string {
  const out: string[] = [];
  let inString = false;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];

    if (inString) {
      if (c === "\\" && i + 1 < json.length) {
        // 正規のエスケープシーケンス → そのまま保持
        out.push(c, json[i + 1]);
        i++;
      } else if (c === '"') {
        out.push(c);
        inString = false;
      } else if (c === "\n") {
        out.push("\\n");
      } else if (c === "\r") {
        out.push("\\r");
      } else if (c === "\t") {
        out.push("\\t");
      } else {
        out.push(c);
      }
    } else {
      out.push(c);
      if (c === '"') {
        inString = true;
      }
    }
  }

  return out.join("");
}

/** 末尾の余分なカンマを除去 */
function removeTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

/**
 * 行ごとに "key": "value" パターンを検出し、
 * 値の中にあるエスケープされていない " を \" に置換する。
 * AI が "また来たい群馬" のような引用をそのまま返すケースに対応。
 */
function fixUnescapedQuotesInValues(json: string): string {
  return json
    .split("\n")
    .map((line) => {
      // "key_name": "...value..." のパターン (末尾にカンマがあってもなくてもOK)
      const m = line.match(/^(\s*"[^"]*"\s*:\s*)"(.*)"(\s*,?\s*)$/);
      if (!m) return line;
      const [, prefix, rawValue, suffix] = m;
      // rawValue 内の未エスケープの " を \" にする
      const fixed = rawValue.replace(/(?<!\\)"/g, '\\"');
      if (fixed === rawValue) return line; // 変更なし
      return `${prefix}"${fixed}"${suffix}`;
    })
    .join("\n");
}

/** 途中で切れたJSONを閉じて有効なJSONにする試み */
function repairTruncatedJson(json: string): string {
  let result = json.trim();

  // 末尾が文字列の途中で切れている場合、引用符を閉じる
  let inStr = false;
  for (let i = 0; i < result.length; i++) {
    const c = result[i];
    if (c === "\\" && inStr) {
      i++; // skip next
    } else if (c === '"') {
      inStr = !inStr;
    }
  }
  if (inStr) {
    result += '"';
  }

  // 開き括弧と閉じ括弧の数を合わせる
  let braces = 0;
  let brackets = 0;
  for (const c of result) {
    if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === "[") brackets++;
    else if (c === "]") brackets--;
  }
  for (let i = 0; i < brackets; i++) result += "]";
  for (let i = 0; i < braces; i++) result += "}";

  return result;
}

export function extractJsonObject(text: string): string | null {
  const stripped = stripCodeFences(text);
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export function parseJsonWithRecovery<T>(raw: string): T {
  // 1) そのまま試す
  try {
    return JSON.parse(raw) as T;
  } catch {
    // continue
  }

  // 2) 文字列中の生改行等をエスケープして試す
  const escaped = removeTrailingCommas(escapeStringContents(raw));
  try {
    return JSON.parse(escaped) as T;
  } catch {
    // continue
  }

  // 3) 値の中のエスケープされていない " を修復して試す
  const quotesFixed = removeTrailingCommas(fixUnescapedQuotesInValues(raw));
  try {
    return JSON.parse(quotesFixed) as T;
  } catch {
    // continue
  }

  // 4) 途中で切れたJSONを補完して試す
  const repaired = repairTruncatedJson(quotesFixed);
  return JSON.parse(repaired) as T;
}

export function parseJsonObjectFromText<T>(text: string): T {
  const json = extractJsonObject(text);
  if (!json) {
    console.error(
      "[json-response] No JSON object found in AI response:",
      text.slice(0, 500)
    );
    throw new Error("AI response does not include a JSON object");
  }
  try {
    return parseJsonWithRecovery<T>(json);
  } catch (err) {
    console.error(
      "[json-response] JSON parse failed:",
      err,
      "\nRaw (around position):",
      json.slice(0, 2000)
    );
    throw err;
  }
}
