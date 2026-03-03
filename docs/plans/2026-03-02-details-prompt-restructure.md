# 詳細作成プロンプト再構成 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 詳細作成プロンプトをAnthropicベストプラクティスに基づき再構成し、出力の重複とバラつきを解消する

**Architecture:** システムプロンプト（details.ts）をXMLタグ構造に書き直し、ルールを20個→5個に削減、具体例2件を追加。API側（route.ts）はユーザープロンプトのデータ配置を最適化（データ上部・指示下部）。

**Tech Stack:** TypeScript, Vercel AI SDK, Claude Sonnet

---

## Task 1: DETAILS_PROMPT（スライド版）の書き直し

**Files:**
- Modify: `lib/ai/prompts/details.ts` (lines 1-78)

**Step 1: 現在のプロンプトのバックアップを確認**

現在の `DETAILS_PROMPT` は78行。以下の構造に全面書き直す。

**Step 2: 新しい DETAILS_PROMPT を書く**

```typescript
export const DETAILS_PROMPT = `<role>
あなたは企画提案書のスライドコンテンツ作成専門家です。ページ構成と確定済みメッセージをもとに、各ページの詳細コンテンツをJSON形式で作成します。
</role>

<rules>
1. スコープ制約: 各ページは確定済みメッセージの「展開」のみを行う。メッセージの範囲を超えた内容や、関係のない情報を追加してはならない。
2. 領域独立: 同じデータ・実績・数値を複数ページで繰り返さない。ある実績をP3で紹介したなら、P5以降では別の切り口で簡潔に言及するか触れない。
3. 具体性: リサーチメモの数値・事例・出典を使い、具体的に書く。「効率化を実現」「最適なソリューション」のような抽象表現は禁止。
4. 量の上限: 箇条書きは最大4点、1点40字以内。スピーカーノートを除くスライド上テキストは合計200字以内。
5. マスター別必須フィールド:
   - COVER: title, subtitle
   - SECTION: title
   - CONTENT_1COL: title, body and/or bullets
   - CONTENT_2COL: title, 左右のbody/bulletsを分けて記述
   - CONTENT_VISUAL: title, body（簡潔に）, 図解の説明
   - DATA_HIGHLIGHT: title, kpis（2-4個）
   - CLOSING: title, body（CTA含む）
</rules>

<output_format>
JSONのみ出力。全ページ分を一度に出力。アイコンはIconify MDI形式（mdi:xxx）で指定。

{
  "pages": [
    {
      "page_number": 1,
      "master_type": "COVER",
      "title": "string",
      "subtitle": "string（該当時）",
      "body": "string（該当時）",
      "bullets": [{ "text": "string", "icon": "mdi:xxx" }],
      "kpis": [{ "value": "string", "label": "string", "description": "string" }],
      "table": { "headers": ["string"], "rows": [["string"]] },
      "chart": { "type": "bar|line|pie", "data": { "labels": [], "values": [] } },
      "notes": "デザイン指示（任意）"
    }
  ]
}
</output_format>

<examples>
<example>
<input>
確定済みメッセージ:
- P3: 現場の業務時間の42%が手作業の転記・集計に費やされている
- P4: RPA導入により年間1,200時間の工数を削減できる
- P5: 導入コスト800万円は8ヶ月で回収でき、3年で2.4倍のROIとなる
</input>
<output>
{
  "pages": [
    {
      "page_number": 3,
      "master_type": "CONTENT_1COL",
      "title": "業務時間の42%が手作業に消えている",
      "body": "2025年の業務量調査（対象: 営業部32名）によると、月間の業務時間4,800時間のうち2,016時間が転記・集計作業でした。特に月末の請求処理では1人あたり平均12時間を費やしています。",
      "bullets": [
        { "text": "転記作業: 月間980時間（受注データ→基幹システム）", "icon": "mdi:file-document-edit" },
        { "text": "集計作業: 月間720時間（部門別売上レポート）", "icon": "mdi:calculator" },
        { "text": "確認・修正: 月間316時間（入力ミスの検出と修正）", "icon": "mdi:alert-circle" }
      ],
      "notes": "円グラフで42%を強調するビジュアルを推奨"
    },
    {
      "page_number": 4,
      "master_type": "CONTENT_1COL",
      "title": "RPA導入で年間1,200時間を削減",
      "body": "UiPathを用いた自動化により、転記・集計の80%を自動処理に移行します。先行導入した大阪支社では、請求処理の所要時間が12時間から2.5時間に短縮されました。",
      "bullets": [
        { "text": "受注データ転記を完全自動化（月間980時間→0時間）", "icon": "mdi:robot" },
        { "text": "売上レポートを毎朝自動配信（月間720時間→120時間）", "icon": "mdi:email-fast" },
        { "text": "入力ミスゼロ化で確認工数を廃止（月間316時間→80時間）", "icon": "mdi:check-decagram" }
      ],
      "notes": "大阪支社の実績写真があれば挿入"
    },
    {
      "page_number": 5,
      "master_type": "DATA_HIGHLIGHT",
      "title": "8ヶ月で投資回収、3年ROIは2.4倍",
      "kpis": [
        { "value": "800万円", "label": "初期導入コスト", "description": "ライセンス＋構築費用" },
        { "value": "8ヶ月", "label": "投資回収期間", "description": "月間削減額100万円で計算" },
        { "value": "2.4倍", "label": "3年ROI", "description": "削減効果3,600万円÷投資総額1,500万円" }
      ],
      "notes": "回収期間のタイムラインを図示"
    }
  ]
}
</output>
<why_this_is_good>
- P3は「課題の大きさ」、P4は「解決方法」、P5は「投資対効果」と各ページの領域が独立している
- P3で示した「2,016時間」「12時間」の数値は、P4・P5では繰り返さず別の切り口で展開している
- bodyが結論で始まり、bulletsが具体的な内訳を示している
- すべての数値にリサーチメモからの根拠がある
</why_this_is_good>
</example>

<example_comparison>
<bad>
{ "text": "効率化を実現", "icon": "mdi:check" }
{ "text": "コスト削減に貢献", "icon": "mdi:cash" }
{ "text": "生産性を向上", "icon": "mdi:trending-up" }
</bad>
<good>
{ "text": "月次レポート作成を8時間→1.5時間に短縮", "icon": "mdi:clock-fast" }
{ "text": "年間ライセンス費用を320万円→180万円に集約", "icon": "mdi:cash-minus" }
{ "text": "1人あたり処理件数を1日15件→42件に増加", "icon": "mdi:trending-up" }
</good>
<reason>左は読み手に何も伝えない。右はリサーチメモの数値を使い、変化の幅を示している。</reason>
</example_comparison>
</examples>`;
```

**Step 3: ファイルに反映**

`lib/ai/prompts/details.ts` の `DETAILS_PROMPT` を上記内容で置き換える。

---

## Task 2: DOCUMENT_DETAILS_PROMPT（ドキュメント版）の書き直し

**Files:**
- Modify: `lib/ai/prompts/details.ts` (lines 80-189)

**Step 1: 新しい DOCUMENT_DETAILS_PROMPT を書く**

スライド版と同じXML構造で、ドキュメント固有のルール（文字数、セクションタイプ、禁止事項）を反映する。

```typescript
export const DOCUMENT_DETAILS_PROMPT = `<role>
あなたはビジネス文書のコンテンツ作成専門家です。章立て構成と確定済みメッセージをもとに、Word文書の各セクションの詳細コンテンツをJSON形式で作成します。
</role>

<rules>
1. スコープ制約: 各セクションは確定済みメッセージの「展開」のみを行う。メッセージの範囲を超えた内容を追加してはならない。
2. 領域独立: 同じデータ・実績・数値を複数セクションで繰り返さない。各セクションは固有の役割に集中し、前後のセクションとつながりを持たせる。
3. 具体性: リサーチメモの数値・事例を使い、具体的に書く。「効率化を実現」のような抽象表現は禁止。読み手が1人で読んで理解できる文章にする。
4. 量の上限:
   - CHAPTER body: 50-150字（導入のみ）
   - SECTION body: 300-600字（結論→根拠→補足の順）
   - SUBSECTION body: 200-400字
   - bullets: 最大5項目、1項目30字以内
   - table: 1セクションあたり最大1つ
5. セクション別必須フィールド:
   - COVER: title, subtitle, body（提出情報）
   - CHAPTER: title, body（導入1-3文）
   - SECTION: title, body（本文）。content_format が "table" なら table 必須、"kpi" なら数値データを table 形式で含める
   - SUBSECTION: title, body
   - CLOSING: title, body（まとめ＋連絡先）
</rules>

<output_format>
JSONのみ出力。全セクション分を一度に出力。chart フィールドとアイコン指定（mdi:xxx）は使用しない。

{
  "pages": [
    {
      "page_number": 1,
      "master_type": "COVER",
      "title": "string",
      "subtitle": "string",
      "body": "string"
    },
    {
      "page_number": 3,
      "master_type": "SECTION",
      "title": "string",
      "body": "string（300-600字）",
      "bullets": ["string（要点）"],
      "table": { "headers": ["string"], "rows": [["string"]] }
    }
  ]
}
</output_format>

<examples>
<example>
<input>
確定済みメッセージ:
- S3: 現場の業務時間の42%が手作業の転記・集計に費やされている
- S4: RPA導入により定型業務の80%を自動化し年間1,200時間を削減できる
</input>
<output>
{
  "pages": [
    {
      "page_number": 3,
      "master_type": "SECTION",
      "title": "業務実態調査：時間の42%が手作業に費やされている",
      "body": "2025年1月に実施した業務量調査（対象：営業部32名、期間：1ヶ月間）の結果、月間の総業務時間4,800時間のうち2,016時間が転記・集計作業に費やされていることが判明しました。\n\n特に深刻なのは月末の請求処理です。1人あたり平均12時間を要しており、本来の営業活動に充てるべき時間を圧迫しています。また、手作業に起因する入力ミスが月平均47件発生しており、その修正対応にさらに月間316時間が消費されています。\n\nこの状況は、人員増加では根本的に解決できません。業務量の増加に比例して手作業も増えるため、自動化による構造的な解決が必要です。",
      "bullets": [
        "転記作業：月間980時間（受注データの基幹システム入力）",
        "集計作業：月間720時間（部門別売上レポートの作成）",
        "確認・修正：月間316時間（入力ミスの検出と修正対応）"
      ]
    },
    {
      "page_number": 4,
      "master_type": "SECTION",
      "title": "RPA導入による自動化：年間1,200時間の工数削減",
      "body": "UiPathを活用したRPA導入により、転記・集計業務の80%を自動処理に移行します。これにより、年間1,200時間の工数削減が見込めます。\n\n先行して導入した大阪支社（営業部8名、2024年10月導入）では、請求処理の所要時間が1人あたり12時間から2.5時間に短縮されました。さらに、入力ミスはゼロとなり、修正対応の工数も完全に解消されています。\n\nこの実績をもとに、全社展開では3段階のロールアウトを計画しています。第1フェーズで受注データ転記、第2フェーズで売上レポート、第3フェーズで請求処理を自動化します。",
      "table": {
        "headers": ["自動化対象", "現状工数（月間）", "導入後工数（月間）", "削減率"],
        "rows": [
          ["受注データ転記", "980時間", "0時間", "100%"],
          ["売上レポート作成", "720時間", "120時間", "83%"],
          ["入力ミス修正", "316時間", "80時間", "75%"]
        ]
      }
    }
  ]
}
</output>
<why_this_is_good>
- S3は「現状の課題」、S4は「解決方法と実績」と領域が独立している
- S3で示した個別の工数はS4では表で変化量を示す形に変え、同じ数値の繰り返しを避けている
- bodyが結論で始まり、段落ごとに論理が展開されている
- 読み手が1人で読んでも文脈がわかる文章になっている
</why_this_is_good>
</example>

<example_comparison>
<bad>
body: "効率化を図ることで、業務改善を実現します。最適なソリューションの導入により、生産性向上が期待されます。"
</bad>
<good>
body: "UiPathを活用したRPA導入により、月間2,016時間の手作業を80%削減します。大阪支社での先行導入では、請求処理時間が1人あたり12時間から2.5時間に短縮されました。"
</good>
<reason>左は主語も数値も曖昧で、読み手は何が起きるか想像できない。右はツール名・数値・実績を含み、1文で提案の核心が伝わる。</reason>
</example_comparison>
</examples>`;
```

**Step 2: ファイルに反映**

`lib/ai/prompts/details.ts` の `DOCUMENT_DETAILS_PROMPT` を上記内容で置き換える。

---

## Task 3: route.ts のユーザープロンプト構成を最適化

**Files:**
- Modify: `app/api/ai/details/route.ts` (lines 95-113)

**Step 1: プロンプト構成部分を書き直す**

現在のコード（lines 95-113）:
```typescript
const messagesSection = confirmedMessages.length > 0
  ? `## 確定済みページメッセージ\n${confirmedMessages.map((m) => `- P${m.page_number}: ${m.message}`).join("\n")}`
  : "";

const prompt = [
  `## 出力タイプ: ${outputType === "document" ? "ドキュメント" : "スライド"}`,
  `## ページ構成\n${compactJsonForPrompt(structure)}`,
  messagesSection,
  researchMemo ? `## リサーチメモ\n${researchMemo}` : "",
  ragContext,
  "\n上記をもとに、全ページの詳細コンテンツを作成してください。",
]
  .filter(Boolean)
  .join("\n\n");
```

新しいコード:
```typescript
const messagesSection = confirmedMessages.length > 0
  ? confirmedMessages.map((m) => `P${m.page_number}: ${m.message}`).join("\n")
  : "";

const prompt = [
  `<input>`,
  `<output_type>${outputType === "document" ? "ドキュメント" : "スライド"}</output_type>`,
  `<structure>\n${compactJsonForPrompt(structure)}\n</structure>`,
  messagesSection ? `<confirmed_messages>\n${messagesSection}\n</confirmed_messages>` : "",
  researchMemo ? `<research_memo>\n${researchMemo}\n</research_memo>` : "",
  ragContext ? `<knowledge_base>\n${ragContext}\n</knowledge_base>` : "",
  `</input>`,
  "",
  "上記の入力をもとに、全ページの詳細コンテンツをJSON形式で作成してください。",
]
  .filter(Boolean)
  .join("\n");
```

**Step 2: ファイルに反映**

`app/api/ai/details/route.ts` の該当箇所を上記で置き換える。

---

## Task 4: 動作確認

**Step 1: TypeScript の型チェック**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: エラーなし（プロンプトは文字列定数のため型エラーは発生しないはず）

**Step 2: 開発サーバーで実際に詳細作成を実行**

1. 開発サーバーを起動
2. 既存のプロジェクトで「詳細作成」ステップを実行
3. 以下を確認:
   - JSON出力が正常にパースされるか
   - ページ間でデータの重複がないか
   - 各ページのbulletsが具体的な内容を含むか
   - master_type ごとの必須フィールドが揃っているか

---

## 変更サマリー

| ファイル | 変更行数（概算） | 内容 |
|----------|------------------|------|
| `lib/ai/prompts/details.ts` | 189行 → 約180行 | 全面書き直し（XML構造、5ルール、例2件 × 2プロンプト） |
| `app/api/ai/details/route.ts` | 18行変更 | プロンプト構成をXMLタグ + データ上部に |

**変更しないファイル:** revise/route.ts, revise-all/route.ts, apply-feedback/route.ts, UI, JSON解析
（これらは system prompt として DETAILS_PROMPT を使うため、自動的に恩恵を受ける）
