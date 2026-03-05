import { NATURAL_WRITING_RULES } from "@/lib/ai/prompt-utils";

const TONE_INSTRUCTIONS: Record<string, string> = {
  logical: `
## 構成トーン：論理型
structure_draftは以下の流れで構成すること：
1. 根拠・データ（なぜ今この課題に取り組むべきか）
2. 現状分析（課題の構造を明確に）
3. 解決策の提示（具体的な施策）
4. 期待効果（数値目標を含む）
5. 実行計画（スケジュール・マイルストーン）
理路整然と積み上げる構成を心がけること。`,

  emotional: `
## 構成トーン：感情型
structure_draftは以下の流れで構成すること：
1. ビジョン（実現したい理想の姿）
2. 現実とのギャップ（共感を喚起する課題描写）
3. 解決の道筋（希望を感じさせる提案）
4. 一緒に実現する未来（協働のイメージ）
ストーリーテリングで心を動かす構成を心がけること。`,

  hybrid: `
## 構成トーン：ハイブリッド
structure_draftは以下の流れで構成すること：
1. 掴み（ビジョンまたはインパクトのある問いかけ）
2. 現状分析（論理的な課題整理）
3. 解決策（データに裏打ちされた具体施策）
4. ストーリー（成功イメージ・共感要素）
5. 実行計画とビジョン（論理と感情の融合で締める）
論理の骨格にストーリーを載せる構成を心がけること。`,
};

export function buildBriefSheetPrompt(tone: string = "hybrid"): string {
  const toneInstruction =
    TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.hybrid;

  return `あなたは企画提案書のブリーフシート作成専門家です。

以下のチャット履歴を分析し、ブリーフシートをJSON形式で出力してください。

## 出力フォーマット (JSON)

{
  "client_info": "クライアント情報（社名/業種/規模/担当者の立場）",
  "background": "背景・課題（現状の課題を2〜3文で）",
  "hypothesis": "提案の方向性（仮説・アイデアの要約）",
  "goal": "ゴール（成功の定義）",
  "constraints": "制約条件（予算/期間/技術/NG事項）",
  "research_topics": "リサーチで確認すべきこと（不確定要素のリスト）",
  "structure_draft": "構成の骨格案（下記のトーン指示に従って構成すること）",
  "reasoning_chain": "結論に至った思考の流れ",
  "rejected_alternatives": "検討したが却下した選択肢とその理由",
  "key_expressions": "議論中に生まれた印象的な表現・フレーズ",
  "discussion_note": "議論全体を物語形式でまとめた要約"
}

${toneInstruction}

${NATURAL_WRITING_RULES}

## 注意事項
- チャット履歴に含まれる情報のみを使用（推測で補完しない）
- 情報がない項目は「（未定）」または「（ヒアリング未実施）」と記載
- structure_draftは選択されたトーンに合わせた提案の流れを具体的に書く
- 全フィールドを途中で打ち切らず、最後まで完結した文章にすること
- 特にhypothesisとstructure_draftは省略せず書き切ること

## 新フィールドの記入ガイド
- reasoning_chain: 「なぜこの方向性になったか」の論理の流れを時系列で記述する。議論の中で方向性が変わった場合はその転換点も含める
- rejected_alternatives: 議論の中で出たが採用しなかった代替案と、その理由を明示する。「〇〇案→△△の理由で不採用」の形式で
- key_expressions: 議論中にユーザーまたはAIが使った、提案書に活かせる印象的な表現やフレーズを列挙する。キャッチコピー候補、メタファー、パワーワードなど
- discussion_note: 議論全体のナラティブ。「何を話し、どう結論に至り、何を外したか」を第三者が読んで追体験できる形式で書く。200〜400文字程度
`;
}

// 後方互換性のため、デフォルトのプロンプトもexport
export const BRIEF_SHEET_PROMPT = buildBriefSheetPrompt("hybrid");
