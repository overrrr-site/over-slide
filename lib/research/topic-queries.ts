export interface TopicQuerySuggestion {
  query: string;
  purpose: string;
  source?: string;
}

const TOPIC_LEADING_MARKER = /^\s*(?:[-*・]|(?:\d+[.)、．）]))\s*/;
const TOPIC_QUESTION_WORDS = /(?:何を|どのように|なぜ|どれくらい|どこまで)\s*/g;
const TOPIC_CONNECTIVE_PHRASES = [
  /(?:それぞれへの|それぞれの|それぞれ)\s*/g,
  /(?:現時点での|現状の)\s*/g,
  /(?:における|に関する|について|に対する|に向けた|としての|として|での|への|による|のうち)\s*/g,
];
const TOPIC_DESCRIPTIVE_PHRASES =
  /(?:想定される|実施した|意欲的な|具体的な|正式な)\s*/g;
const TOPIC_ACTION_SUFFIX =
  /(の)?(?:調査|確認|把握|検証|分析|比較|調べる|収集)(?:する|したい|してください)?$/;
const TRAILING_PARTICLES = /[のをにへとがはもで]\s*$/;
const SEARCH_OPERATOR_HINT =
  /(?:\b(?:site|filetype|intitle|inurl)\s*:|["'`]|(?:^|\s)-\w+|\b(?:AND|OR|NOT)\b)/i;
const JAPANESE_CHAR_HINT = /[\u3040-\u30ff\u3400-\u9fff]/;
const TOPIC_SENTENCE_HINT =
  /(?:について|に関する|における|それぞれ|現時点|可否|要否|方針|温度感|実績データ|市場規模|提出期限|評価基準|制作可否|版権調整|棚卸し)/;

export function splitResearchTopics(text: string): string[] {
  if (!text.trim()) return [];

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const cleanedLines = normalized
    .split("\n")
    .map((line) =>
      line.replace(TOPIC_LEADING_MARKER, "").trim()
    )
    .filter(Boolean);

  if (cleanedLines.length > 1) return cleanedLines;

  const numbered = normalized
    .split(/\d+[.)、．）\s]+/)
    .map((item) =>
      item
        .replace(/^\s*(?:[-*・])\s*/, "")
        .trim()
    )
    .filter(Boolean);

  return numbered.length > 0 ? numbered : cleanedLines;
}

export function convertTopicToQuery(topic: string): string {
  let query = topic
    .replace(/\u3000/g, " ")
    .replace(/[。．！？?]/g, " ")
    .replace(/[「」『』【】［］（）()]/g, " ")
    .replace(/[,:：;；、，・／/|]/g, " ")
    .replace(TOPIC_QUESTION_WORDS, "")
    .trim();

  for (const pattern of TOPIC_CONNECTIVE_PHRASES) {
    query = query.replace(pattern, " ");
  }

  query = query
    .replace(TOPIC_DESCRIPTIVE_PHRASES, " ")
    .replace(
      /(?:を|について|に関する)\s*(?:調査|確認|把握|検証|分析|比較|調べる)(?:する|したい|してください)?/g,
      " "
    )
    .replace(/を?(?:調査|確認|把握|検証|分析|比較)(?:する|したい|してください)?$/g, " ")
    .replace(/(?:について|に関する)(?:調べる|確認する)?$/g, " ")
    .replace(/(?:かどうか|可能性)$/g, " ")
    .replace(TOPIC_ACTION_SUFFIX, " ")
    .replace(/\s(?:の|を|に|へ|で|と|が|は|も)\s*/g, " ")
    .replace(/([^\sぁ-ん])(?:の|を|に|へ|で|と|が|は)(?=[^\s])/g, "$1 ")
    .replace(/([^\sぁ-ん])(?:の|を|に|へ|で|と|が|は)(?=\s|$)/g, "$1 ")
    .replace(/など(?=\s|$)/g, " ")
    .replace(/(?:^|\s)など(?:\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  while (TRAILING_PARTICLES.test(query)) {
    query = query.replace(TRAILING_PARTICLES, "").trim();
  }

  return query || topic.trim();
}

function shouldNormalizeKeywordLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (SEARCH_OPERATOR_HINT.test(text)) return false;
  if (!JAPANESE_CHAR_HINT.test(text)) return false;
  if (text.length < 10) return false;
  return TOPIC_SENTENCE_HINT.test(text);
}

export function normalizeKeywordTextToQueries(text: string): string {
  if (!text.trim()) return "";

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const sourceLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates =
    sourceLines.length === 1 ? splitResearchTopics(sourceLines[0]) : sourceLines;
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const line = candidate.trim();
    if (!line) continue;
    const query = shouldNormalizeKeywordLine(line)
      ? convertTopicToQuery(line)
      : line;
    if (!query || seen.has(query)) continue;
    seen.add(query);
    deduped.push(query);
  }

  return deduped.join("\n");
}

export function parseResearchTopicsToQueries(
  text: string
): TopicQuerySuggestion[] {
  const topics = splitResearchTopics(text);
  const seen = new Set<string>();

  return topics
    .map((topic) => {
      const query = convertTopicToQuery(topic);
      return {
        query,
        source: topic,
        purpose: `調査項目: ${topic}`,
      };
    })
    .filter((item) => {
      if (!item.query || seen.has(item.query)) return false;
      seen.add(item.query);
      return true;
    });
}
