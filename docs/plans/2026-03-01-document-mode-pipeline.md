# ドキュメントモード専用パイプライン実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** output_type が "document" の場合、構成・詳細生成を文書向けに最適化し、スライド変換ではなく最初から文書として設計された高品質な .docx を出力する。

**Architecture:** 構成（structure）プロンプトと詳細（details）プロンプトをそれぞれ文書用に分岐させる。構成では「ページ」ではなく「章・節」の階層構造を出力し、詳細では箇条書き主体ではなく段落主体のビジネス文書を生成する。既存のスライド用パイプラインは一切変更しない。

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + Storage), Anthropic Claude (Opus/Sonnet via AI SDK), docx npm package

---

## 背景と現状の問題

### 現在の流れ

```
調査 → 構成作成(スライド用) → 詳細作成(スライド用) → Word変換(後付け)
```

### 問題

| 段階 | スライド用の作り方 | 文書で本来あるべき姿 |
|---|---|---|
| 構成 | 1ページ1トピック、master_type でレイアウト指定 | 章→節→項の階層構造 |
| 詳細 | bullets 主体、body は補助、2COL はレイアウト指示 | 段落主体、表は情報整理、セクション間に接続 |
| 出力 | PPTX（そのまま使える） | DOCX（スライドデータを無理やり変換→品質低） |

### 理想の流れ

```
調査 → 構成作成(文書用) → 詳細作成(文書用) → Word生成(ネイティブ)
```

---

## 変更対象ファイル一覧

| # | ファイル | 変更種別 | 概要 |
|---|---|---|---|
| 1 | `lib/ai/prompts/structure.ts` | 修正 | 文書用プロンプトを追加 |
| 2 | `app/api/ai/structure/route.ts` | 修正 | output_type で分岐 |
| 3 | `lib/ai/prompts/details.ts` | 修正 | 文書用プロンプトを追加 |
| 4 | `app/api/ai/details/route.ts` | 修正 | 文書用プロンプトを選択 |
| 5 | `app/(app)/projects/[projectId]/design/page.tsx` | 修正 | 文書用データ変換の簡略化 |
| 6 | `lib/docx/types.ts` | 確認のみ | 型定義は現状で十分 |
| 7 | `lib/docx/generator.ts` | 確認のみ | 生成ロジックは現状で十分 |

---

## Task 1: 文書用構成プロンプトの作成

**Files:**
- Modify: `lib/ai/prompts/structure.ts`

### 設計方針

文書用の構成では master_type の代わりに `section_type` を使う。1ページ＝1トピックではなく、章→節の階層構造を定義する。

### 文書用セクションタイプ

| section_type | 用途 | 文書での見え方 |
|---|---|---|
| `COVER` | 表紙 | タイトル + サブタイトル + 提出情報 |
| `CHAPTER` | 章の区切り | H1 見出し + 導入文 |
| `SECTION` | 節（主要な内容ブロック） | H2 見出し + 本文 + 表/箇条書き |
| `SUBSECTION` | 項（補足・詳細） | H3 見出し + 本文 |
| `CLOSING` | 結び | H1 見出し + 締めの文章 |

**注意:** スライド用の `CONTENT_1COL`, `CONTENT_2COL`, `CONTENT_VISUAL`, `DATA_HIGHLIGHT` は使わない。これらはスライドのレイアウト概念であり、文書には不要。

### Step 1: `DOCUMENT_STRUCTURE_PROMPT` を追加

`lib/ai/prompts/structure.ts` に以下を追記する（既存の `STRUCTURE_PROMPT` は変更しない）:

```typescript
export const DOCUMENT_STRUCTURE_PROMPT = `あなたはビジネス文書の構成設計専門家です。

ブリーフシート、リサーチメモ、およびナレッジベースからの参考情報をもとに、提案書の章立て構成を作成してください。

## 重要な前提
これはWord文書として提出される企画提案書です。スライドではありません。
- 読み手が1人で読んで理解できる構成にすること
- 章→節→項の階層構造で論理的に整理すること
- 各セクションは前後のセクションとつながりを持つこと

## 出力フォーマット (JSON)

{
  "pages": [
    {
      "page_number": 1,
      "master_type": "COVER | CHAPTER | SECTION | SUBSECTION | CLOSING",
      "title": "見出しテキスト",
      "purpose": "このセクションの役割",
      "key_content": "含めるべき主要コンテンツの概要",
      "content_format": "prose | table | kpi | mixed",
      "message": "このセクションで伝えること（30字以内の1文）",
      "notes": "特記事項（任意）"
    }
  ]
}

## セクションタイプの使い分け
- **COVER**: 表紙（1つ目のみ）。タイトル、サブタイトル、提出先・提出者・提出日
- **CHAPTER**: 章の区切り。大きなテーマの転換点に使用。導入の1-2文を含む
- **SECTION**: 節。章の中の主要な内容ブロック。本文・表・データを含む
- **SUBSECTION**: 項。節の中の補足・詳細説明。必要な場合のみ使用
- **CLOSING**: 結び（最後の1つのみ）。全体のまとめと連絡先

## content_format の使い分け
- **prose**: 段落主体の説明（デフォルト）
- **table**: 比較表・一覧表で整理すべき情報
- **kpi**: 数値データを強調すべきセクション
- **mixed**: 段落 + 表の組み合わせ

## 構成のガイドライン
- 全体は15〜30セクション程度（章5つ前後 × 節3-5つ）
- ストーリーライン: 課題提起 → 解決策 → 具体的な提案 → 実行計画 → 効果・根拠 → まとめ
- 各CHAPTERの直下にSECTIONを配置（CHAPTERの連続は禁止）
- SUBSECTIONはSECTIONの直後にのみ配置（SUBSECTIONの連続は2つまで）
- リサーチメモの定量データは、content_format: "table" または "kpi" で活用
- 比較・対比がある内容は、2カラムレイアウトではなく content_format: "table" で表にする

## ページメッセージ
- 各セクションに message フィールドを必ず含める
- messageは「このセクションで伝えること」を30字以内の1文で表現
- 具体的かつ断定的に記述

## 注意事項
- ブリーフシートの方向性を忠実に反映
- リサーチメモのデータを活用できるセクションを含める
- JSONのみを出力
`;
```

### Step 2: ビルド確認

```bash
npx next build
```

Expected: ビルド成功（export を追加しただけ）

### Step 3: コミット

```bash
git add lib/ai/prompts/structure.ts
git commit -m "feat: add DOCUMENT_STRUCTURE_PROMPT for document mode"
```

---

## Task 2: 構成 API を output_type で分岐

**Files:**
- Modify: `app/api/ai/structure/route.ts`

### 設計方針

`projects.output_type` を参照し、"document" の場合は `DOCUMENT_STRUCTURE_PROMPT` を使う。

### Step 1: import 追加と output_type 取得ロジック追加

```typescript
import { STRUCTURE_PROMPT, DOCUMENT_STRUCTURE_PROMPT } from "@/lib/ai/prompts/structure";
```

`const body = await request.json();` の後、`streamText` の前に以下を追加:

```typescript
// output_type に応じてプロンプトを切り替え
let outputType = "slide";
if (projectId) {
  const { data: projectData } = await supabase
    .from("projects")
    .select("output_type")
    .eq("id", projectId)
    .single();
  if (projectData?.output_type) {
    outputType = projectData.output_type;
  }
}

const systemPrompt = outputType === "document"
  ? DOCUMENT_STRUCTURE_PROMPT
  : STRUCTURE_PROMPT;
```

### Step 2: streamText の system を差し替え

```typescript
const result = streamText({
  model: opus,
  system: systemPrompt,  // ← STRUCTURE_PROMPT から変更
  prompt,
  // ... rest unchanged
});
```

### Step 3: ビルド確認

```bash
npx next build
```

### Step 4: コミット

```bash
git add app/api/ai/structure/route.ts
git commit -m "feat: use document-specific structure prompt when output_type is document"
```

---

## Task 3: 文書用詳細プロンプトの作成

**Files:**
- Modify: `lib/ai/prompts/details.ts`

### 設計方針

文書用の詳細プロンプトは根本的に異なるアプローチをとる:
- `bullets` や `icon` の概念を排除
- `body` を段落主体の本文として扱う（スライドの「補足テキスト」ではなく）
- `table` を情報整理のツールとして積極活用
- `bodyLeft`/`bodyRight` の概念を排除（2カラムはレイアウトであり、文書の概念ではない）
- セクション間の接続を意識した文章を生成

### Step 1: `DOCUMENT_DETAILS_PROMPT` を追加

`lib/ai/prompts/details.ts` に以下を追記（既存の `DETAILS_PROMPT` は変更しない）:

```typescript
export const DOCUMENT_DETAILS_PROMPT = `あなたはビジネス文書のコンテンツ作成専門家です。

章立て構成、リサーチメモ、およびナレッジベースからの参考表現をもとに、各セクションの詳細コンテンツを作成してください。

## 重要な前提
これはWord文書として提出される企画提案書です。スライドではありません。
- 読み手が1人で読んで理解できる文章を書くこと
- 各セクションは独立した断片ではなく、前後のセクションとつながりを持つこと
- データや根拠は本文中に自然に組み込むこと

## 出力フォーマット (JSON)

{
  "pages": [
    {
      "page_number": 1,
      "master_type": "COVER",
      "title": "文書タイトル",
      "subtitle": "サブタイトル",
      "body": "提出日・提出先・提案者などの情報"
    },
    {
      "page_number": 2,
      "master_type": "CHAPTER",
      "title": "章タイトル",
      "body": "この章の導入（1-2文）"
    },
    {
      "page_number": 3,
      "master_type": "SECTION",
      "title": "節タイトル",
      "body": "本文。結論→根拠→補足の順。300-600字程度。",
      "bullets": ["要点1", "要点2", "要点3"],
      "table": {
        "headers": ["項目", "内容", "備考"],
        "rows": [["データ1", "値1", "説明1"]]
      }
    }
  ]
}

## ページメッセージによる制約
各セクションの生成は、確定済みメッセージを「展開」することのみを目的とする。
メッセージの範囲を超えた内容を追加してはならない。

## セクションタイプ別の出力ルール

### COVER（表紙）
- 必須: title, subtitle
- body: 提出情報（提出日、提出先、提案者）を改行区切りで記述

### CHAPTER（章）
- 必須: title
- body: この章で扱うテーマの導入。1-3文。読み手の関心を引く書き出し

### SECTION（節）
- 必須: title, body
- body: 本文を段落として記述。300-600字。結論→根拠→補足の順
- bullets: 要点リスト（任意）。本文の補足として3-5項目。各項目は体言止めか短文
- table: データの整理が必要な場合（任意）。headers と rows を含む

### SUBSECTION（項）
- 必須: title, body
- body: 補足説明。200-400字
- table: データがある場合（任意）

### CLOSING（結び）
- 必須: title, body
- body: 提案全体のまとめ。3つの価値を簡潔に示し、印象的な一文で締める。連絡先を含む

## ライティングガイドライン

### 文体
- 「です・ます」調で統一
- 結論→根拠→補足の順で記述
- 段落の冒頭で結論を述べ、読み手が斜め読みしても要点がわかるようにする

### 構造化のルール
- 本文（body）は「読ませる」パート。説明・論理展開・背景を書く
- 箇条書き（bullets）は「見せる」パート。本文で述べた要点を構造的に整理する
- 表（table）は「比較・一覧」パート。定量データ、比較、スケジュールなどに使う
- content_format が "table" のセクションには、必ず table を含める
- content_format が "kpi" のセクションには、数値データを table 形式で含める

### 量的制約
- SECTION の body: 300-600字
- SUBSECTION の body: 200-400字
- CHAPTER の body: 50-150字（導入のみ）
- bullets: 1セクションあたり最大5項目、1項目30字以内
- table: 1セクションあたり最大1つ

### 禁止事項
- 「左カラム:」「右カラム:」などのレイアウト指示を含めない
- 同じ内容の言い換えや繰り返しを禁止
- アイコン指定（mdi:xxx）は不要
- chart フィールドは使用しない（文書では図表を直接生成できないため）

## 注意事項
- JSONのみを出力
- 全セクション分を一度に出力
`;
```

### Step 2: ビルド確認

```bash
npx next build
```

### Step 3: コミット

```bash
git add lib/ai/prompts/details.ts
git commit -m "feat: add DOCUMENT_DETAILS_PROMPT for document mode"
```

---

## Task 4: 詳細 API を output_type で分岐

**Files:**
- Modify: `app/api/ai/details/route.ts`

### Step 1: import を更新

```typescript
import { DETAILS_PROMPT, DOCUMENT_DETAILS_PROMPT } from "@/lib/ai/prompts/details";
```

### Step 2: プロンプト選択ロジックを追加

既存の `outputType` 変数取得ロジック（57-87行目）の後、`prompt` 組み立ての直前に:

```typescript
const systemPrompt = outputType === "document"
  ? DOCUMENT_DETAILS_PROMPT
  : DETAILS_PROMPT;
```

### Step 3: streamText の system を差し替え

```typescript
const result = streamText({
  model: sonnet,
  system: systemPrompt,  // ← DETAILS_PROMPT から変更
  prompt,
  // ... rest unchanged
});
```

### Step 4: ビルド確認

```bash
npx next build
```

### Step 5: コミット

```bash
git add app/api/ai/details/route.ts
git commit -m "feat: use document-specific details prompt when output_type is document"
```

---

## Task 5: design/page.tsx の buildDocumentData を文書用データに対応

**Files:**
- Modify: `app/(app)/projects/[projectId]/design/page.tsx`

### 設計方針

文書用プロンプトから生成されるデータは `CHAPTER` / `SECTION` / `SUBSECTION` の master_type を使うため、`buildDocumentData` に対応を追加する。既存のスライド用 master_type（CONTENT_1COL 等）の処理はそのまま残す（後方互換性）。

### Step 1: CHAPTER / SECTION / SUBSECTION の case を追加

`buildDocumentData` 関数の switch 文に以下を追加（既存の case の後、default の前）:

```typescript
case "CHAPTER": {
  // 文書用: 章見出し (level 1) + 導入文
  const section: DocxSection = { level: 1, title };
  const body = page.body as string | undefined;
  if (body) section.body = body;
  sections.push(section);
  break;
}

case "SUBSECTION": {
  // 文書用: 項見出し (level 3) + 本文 + 箇条書き
  const section: DocxSection = { level: 3, title };
  const body = page.body as string | string[] | undefined;
  const bullets = page.bullets as
    | string[]
    | Array<{ text: string }>
    | undefined;
  const table = page.table as
    | { headers: string[]; rows: string[][] }
    | undefined;

  if (body) {
    section.body = body;
  }
  if (bullets && bullets.length > 0) {
    if (body) {
      section.bullets = normalizeBullets(bullets);
    } else {
      section.body = normalizeBullets(bullets);
    }
  }
  if (table) {
    section.table = table as DocxTableData;
  }
  sections.push(section);
  break;
}
```

**注意:** 既存の `"SECTION"` case はスライド用で level: 1 を使っている。文書用の `"SECTION"` は level: 2 にすべきだが、スライド用データとの互換性を保つため、ここでは新しい master_type（CHAPTER/SUBSECTION）の追加のみ行う。文書用プロンプトからの出力は CHAPTER が H1、既存 SECTION が H1 を使うが、文書モードでは CHAPTER が章に相当するため問題ない。

### 追加の考慮: 文書用 SECTION を level: 2 にする

文書用データでは CHAPTER が H1、SECTION が H2 であるべき。しかし既存のスライド用 SECTION は level: 1。この衝突を解決するため、output_type を buildDocumentData に渡す方法もあるが、実際には文書用プロンプトが CHAPTER を使うようになればスライド用の SECTION case は文書モードでは呼ばれなくなるため、問題は生じない。

ただし安全のため、buildDocumentData のスライド用 "SECTION" case にコメントを追加:

```typescript
case "SECTION": {
  // スライド用: セクション区切り → 章見出し (level 1)
  // 文書用では CHAPTER が chapter になるため、この case は後方互換用
  sections.push({
    level: 1,
    title,
    body: page.body as string | undefined,
  });
  break;
}
```

### Step 2: ビルド確認

```bash
npx next build
```

### Step 3: コミット

```bash
git add app/(app)/projects/[projectId]/design/page.tsx
git commit -m "feat: support CHAPTER/SUBSECTION master_types in buildDocumentData"
```

---

## Task 6: 結合テスト（手動）

### 手順

1. 開発サーバーを起動
2. ドキュメントモードで新規プロジェクトを作成（または既存プロジェクトの構成を再生成）
3. 構成ステップで生成される内容を確認:
   - CHAPTER / SECTION / SUBSECTION が使われているか
   - 章→節→項の階層構造になっているか
   - 全体が15-30セクション程度か
4. 詳細ステップで生成される内容を確認:
   - body が段落主体か（箇条書き主体ではないか）
   - 「左カラム:」「右カラム:」がないか
   - table が適切に含まれているか
   - bullets がアイコンなし（text のみ）か
5. 文書生成してダウンロード:
   - H1（CHAPTER）/ H2（SECTION）/ H3（SUBSECTION）の階層が正しいか
   - 本文の量が十分か（300-600字/節）
   - 表が含まれているか
   - 箇条書きが構造化されているか

### 確認ポイント

- [ ] 構成: CHAPTER / SECTION / SUBSECTION が使われる
- [ ] 構成: content_format が指定される
- [ ] 詳細: body が段落主体
- [ ] 詳細: bullets がアイコンなし
- [ ] 詳細: table が適切に含まれる
- [ ] 詳細: 「左カラム:」「右カラム:」がない
- [ ] DOCX: 見出し階層が正しい
- [ ] DOCX: 本文量が十分
- [ ] DOCX: 既存のスライドモードが壊れていない

---

## 変更しないもの（明示）

以下は今回の変更対象外。理由と合わせて記載:

| ファイル | 理由 |
|---|---|
| `lib/docx/generator.ts` | CHAPTER→level:1、SECTION→level:2 のマッピングは buildDocumentData が行うため、生成ロジック自体は変更不要 |
| `lib/docx/types.ts` | DocxSection の level 1/2/3 と bullets フィールドで文書用データも表現可能 |
| `app/api/docx/generate/route.ts` | DocumentData を受け取って生成するだけなので変更不要 |
| `app/api/docx/download/route.ts` | ダウンロードプロキシなので変更不要 |
| DB スキーマ | structures.pages と page_contents.content は JSONB なので、新しい master_type もそのまま格納可能 |
| スライド用の既存プロンプト | 一切変更しない。文書用を追加するのみ |

---

## リスクと注意点

1. **既存スライドデータとの互換性**: 既に生成済みのスライドデータ（CONTENT_1COL等）は buildDocumentData の既存 case で処理される。新しいプロンプトで生成し直さない限り、既存プロジェクトの出力は変わらない

2. **構成の確認ステップ**: 構成ページ UI で master_type バッジが表示される。新しい CHAPTER/SUBSECTION に対応する色の追加が必要かもしれない（ただし文書モードではバッジ非表示のため、優先度低）

3. **プロンプトの品質**: 初版プロンプトで完璧な出力は期待しない。実際の出力を見てプロンプトを調整する必要がある（特に content_format の活用度合い）

4. **page_number の意味変化**: スライドでは物理的な「ページ番号」だが、文書では「セクション番号」として扱われる。DB上は同じフィールドなので問題ないが、UI表示で「ページ3」と表示される箇所がある場合は要注意
