# pptx生成ライブラリ 技術検証レポート

## 1. 候補比較

### PptxGenJS（JavaScript/Node.js）

| 項目 | 評価 |
|------|------|
| **GitHubスター** | 4,600+ |
| **週間ダウンロード** | 551,000+ |
| **Vercel互換性** | ◎ Node.js環境でそのまま動作 |
| **依存関係** | JSZipのみ（実質ゼロ依存） |
| **Master Slide** | ◎ defineSlideMaster()で定義可能 |
| **チャート** | ◎ area, bar, bar3D, bubble, doughnut, line, pie, radar, scatter |
| **テーブル** | ◎ セル単位の書式設定、HTML table変換対応 |
| **画像** | ◎ base64, ファイルパス, URL, SVG対応 |
| **日本語フォント** | ◎ Asian fonts対応を明記 |
| **出力形式** | arraybuffer, base64, blob, nodebuffer, stream |
| **TypeScript** | ◎ 完全な型定義付き |
| **ライセンス** | MIT |

### python-pptx（Python）

| 項目 | 評価 |
|------|------|
| **GitHubスター** | 2,300+ |
| **Vercel互換性** | △ Python runtime必要。Vercelでは制約あり |
| **依存関係** | lxml, Pillow等 |
| **テンプレート** | ◎ 既存.pptxをテンプレートとして読み込み可能 |
| **チャート** | ◎ PowerPointネイティブチャート生成 |
| **テーブル** | ◎ |
| **日本語フォント** | ○ 指定可能だが特別なサポートなし |
| **ライセンス** | MIT |

### PPTX-Automizer（Node.js / PptxGenJS拡張）

| 項目 | 評価 |
|------|------|
| **特徴** | 既存pptxテンプレートからスライドを流し込むアプローチ |
| **Vercel互換性** | ◎ Node.js |
| **ユースケース** | デザイナーが作ったマスターファイルにデータ注入 |
| **制約** | PptxGenJSより新しくコミュニティが小さい |

---

## 2. 結論：PptxGenJS を推奨

**決め手：**

1. **Vercel完全互換** — Node.jsネイティブなのでAPI RoutesやServerless Functionsでそのまま動く。python-pptxだとPythonランタイムの追加構成が必要
2. **Master Slide対応** — `defineSlideMaster()`でテンプレートをコードで定義できる。デザイン1種類固定の要件に最適
3. **チャート機能が充実** — 9種のチャートをネイティブサポート。インフォグラフィックの一部はチャートとして直接生成可能
4. **画像のbase64対応** — HTML→画像変換したインフォグラフィックをbase64で直接埋め込める
5. **エコシステム** — 週55万DL、TypeScript完全対応、LLMが学習済みでClaudeがコード生成しやすい

**python-pptxを選ばない理由：**
- Vercel上でPythonを動かすには追加のworkerが必要（コスト・複雑性増）
- 既存テンプレート読み込みは強みだが、今回はデザイン1種固定なのでコード定義で十分
- python-pptxの方が歴史が長く安定しているが、PptxGenJSも十分に成熟

---

## 3. アーキテクチャ設計

### pptx生成のフロー

```
Claude API → 構造化JSON → PptxGenJS → .pptx (Buffer)
                                          ↓
                              Supabase Storage に保存
                                          ↓
                              ダウンロードURL を返却
```

### Vercel上での実行方式

```
Next.js API Route (/api/generate-pptx)
  ├─ リクエスト受信（構造化されたスライドデータJSON）
  ├─ PptxGenJSでpptx生成（メモリ上）
  ├─ Buffer → Supabase Storageにアップロード
  └─ ダウンロードURL返却
```

**Vercelの制約と対策：**
- Serverless Function タイムアウト：Hobbyプラン10秒 / Proプラン60秒
- 20ページ程度のスライド生成は通常5秒以内で完了するため問題なし
- 大量の画像埋め込みがある場合はProプラン推奨

---

## 4. プロトタイプコード

### 4.1 テンプレート定義（マスタースライド）

```typescript
// lib/pptx/template.ts
import PptxGenJS from "pptxgenjs";

// ── カラースキーム（管理画面から変更可能にする想定） ──
export interface ColorScheme {
  primary: string;    // メインカラー（例："1A73E8"）
  accent: string;     // アクセントカラー（例："34A853"）
  dark: string;       // 濃い背景・テキスト（例："202124"）
  gray: string;       // グレー系（例："5F6368"）
  lightGray: string;  // 薄いグレー（例："F1F3F4"）
  white: string;      // 白（例："FFFFFF"）
}

export const DEFAULT_COLORS: ColorScheme = {
  primary: "1A73E8",
  accent: "34A853",
  dark: "202124",
  gray: "5F6368",
  lightGray: "F1F3F4",
  white: "FFFFFF",
};

// ── フォント設定 ──
const FONT = {
  main: "Noto Sans JP",     // 本文
  heading: "Noto Sans JP",  // 見出し
  fallback: "Arial",        // フォールバック
};

// ── マスタースライド定義 ──
export function defineTemplate(pptx: PptxGenJS, colors: ColorScheme = DEFAULT_COLORS) {
  pptx.layout = "LAYOUT_WIDE"; // 16:9
  pptx.author = "SlideGen System";

  // テーマフォント設定
  pptx.theme = { headFontFace: FONT.heading, bodyFontFace: FONT.main };

  // ── 1. 表紙 ──
  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: colors.primary },
    objects: [
      {
        rect: { x: 0, y: 5.0, w: "100%", h: 2.5, fill: { color: colors.dark } },
      },
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: 0.8, y: 1.5, w: 11.5, h: 2.0,
            fontFace: FONT.heading, fontSize: 36, color: colors.white,
            bold: true,
          },
          text: "（タイトル）",
        },
      },
      {
        placeholder: {
          options: {
            name: "subtitle",
            type: "body",
            x: 0.8, y: 5.3, w: 11.5, h: 0.8,
            fontFace: FONT.main, fontSize: 18, color: colors.lightGray,
          },
          text: "（サブタイトル）",
        },
      },
      {
        text: {
          text: "CONFIDENTIAL",
          options: {
            x: 0.8, y: 6.8, w: 3, h: 0.4,
            fontFace: FONT.main, fontSize: 10, color: colors.gray,
          },
        },
      },
    ],
  });

  // ── 2. セクション区切り ──
  pptx.defineSlideMaster({
    title: "SECTION",
    background: { color: colors.dark },
    objects: [
      {
        rect: { x: 0.5, y: 3.2, w: 2.0, h: 0.06, fill: { color: colors.accent } },
      },
      {
        placeholder: {
          options: {
            name: "sectionTitle",
            type: "title",
            x: 0.5, y: 1.5, w: 12.0, h: 1.5,
            fontFace: FONT.heading, fontSize: 32, color: colors.white,
            bold: true,
          },
          text: "（セクションタイトル）",
        },
      },
      {
        placeholder: {
          options: {
            name: "sectionDesc",
            type: "body",
            x: 0.5, y: 3.6, w: 8.0, h: 1.0,
            fontFace: FONT.main, fontSize: 16, color: colors.gray,
          },
          text: "",
        },
      },
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });

  // ── 3. タイトル＋本文（1カラム） ──
  pptx.defineSlideMaster({
    title: "CONTENT_1COL",
    background: { color: colors.white },
    objects: [
      {
        rect: { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: colors.lightGray } },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8, y: 0.2, w: 11.5, h: 0.8,
            fontFace: FONT.heading, fontSize: 22, color: colors.dark,
            bold: true,
          },
          text: "（ページタイトル）",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.8, y: 1.5, w: 11.5, h: 5.0,
            fontFace: FONT.main, fontSize: 14, color: colors.dark,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });

  // ── 4. タイトル＋2カラム ──
  pptx.defineSlideMaster({
    title: "CONTENT_2COL",
    background: { color: colors.white },
    objects: [
      {
        rect: { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: colors.lightGray } },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8, y: 0.2, w: 11.5, h: 0.8,
            fontFace: FONT.heading, fontSize: 22, color: colors.dark,
            bold: true,
          },
          text: "（ページタイトル）",
        },
      },
      {
        placeholder: {
          options: {
            name: "bodyLeft",
            type: "body",
            x: 0.8, y: 1.5, w: 5.4, h: 5.0,
            fontFace: FONT.main, fontSize: 14, color: colors.dark,
            valign: "top",
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "bodyRight",
            type: "body",
            x: 6.8, y: 1.5, w: 5.4, h: 5.0,
            fontFace: FONT.main, fontSize: 14, color: colors.dark,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });

  // ── 5. タイトル＋図表（全面画像） ──
  pptx.defineSlideMaster({
    title: "CONTENT_VISUAL",
    background: { color: colors.white },
    objects: [
      {
        rect: { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: colors.lightGray } },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8, y: 0.2, w: 11.5, h: 0.8,
            fontFace: FONT.heading, fontSize: 22, color: colors.dark,
            bold: true,
          },
          text: "（ページタイトル）",
        },
      },
      // 画像エリアはプレースホルダーではなく、動的に配置
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });

  // ── 6. データ・数値ハイライト ──
  pptx.defineSlideMaster({
    title: "DATA_HIGHLIGHT",
    background: { color: colors.white },
    objects: [
      {
        rect: { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: colors.lightGray } },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8, y: 0.2, w: 11.5, h: 0.8,
            fontFace: FONT.heading, fontSize: 22, color: colors.dark,
            bold: true,
          },
          text: "（ページタイトル）",
        },
      },
      // KPIカード等は動的に配置
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });

  // ── 7. まとめ / Next Steps ──
  pptx.defineSlideMaster({
    title: "CLOSING",
    background: { color: colors.lightGray },
    objects: [
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8, y: 0.5, w: 11.5, h: 1.0,
            fontFace: FONT.heading, fontSize: 28, color: colors.dark,
            bold: true,
          },
          text: "Next Steps",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.8, y: 1.8, w: 11.5, h: 4.5,
            fontFace: FONT.main, fontSize: 16, color: colors.dark,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: { x: 12.0, y: 7.0, color: colors.gray, fontSize: 10 },
  });
}
```

### 4.2 スライド生成API（Claude出力 → pptx変換）

```typescript
// lib/pptx/generator.ts
import PptxGenJS from "pptxgenjs";
import { defineTemplate, ColorScheme, DEFAULT_COLORS } from "./template";

// ── Claude APIが返すスライドデータの型定義 ──
export interface SlideData {
  masterName: "COVER" | "SECTION" | "CONTENT_1COL" | "CONTENT_2COL" | "CONTENT_VISUAL" | "DATA_HIGHLIGHT" | "CLOSING";
  title: string;
  subtitle?: string;
  body?: string | string[];       // テキスト or 箇条書き
  bodyLeft?: string | string[];   // 2カラム左
  bodyRight?: string | string[];  // 2カラム右
  image?: {                       // 画像（インフォグラフィック等）
    data: string;                 // base64
    w: number;
    h: number;
  };
  chart?: {                       // チャート
    type: "bar" | "line" | "pie" | "doughnut" | "area" | "radar";
    data: Array<{
      name: string;
      labels: string[];
      values: number[];
    }>;
    options?: Record<string, unknown>;
  };
  table?: {                       // テーブル
    headers: string[];
    rows: string[][];
  };
  kpiCards?: Array<{              // KPIカード（DATA_HIGHLIGHT用）
    label: string;
    value: string;
    unit?: string;
    color?: string;
  }>;
  notes?: string;                 // スピーカーノート
}

export interface PresentationData {
  title: string;
  slides: SlideData[];
  colors?: ColorScheme;
}

// ── メイン生成関数 ──
export async function generatePptx(data: PresentationData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const colors = data.colors || DEFAULT_COLORS;

  // テンプレート定義
  defineTemplate(pptx, colors);
  pptx.title = data.title;

  // スライド生成
  for (const slideData of data.slides) {
    const slide = pptx.addSlide({ masterName: slideData.masterName });

    // スピーカーノート
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    // マスターに応じた配置
    switch (slideData.masterName) {
      case "COVER":
        addCoverContent(slide, slideData, colors);
        break;
      case "SECTION":
        addSectionContent(slide, slideData);
        break;
      case "CONTENT_1COL":
        addContent1Col(slide, slideData, colors);
        break;
      case "CONTENT_2COL":
        addContent2Col(slide, slideData, colors);
        break;
      case "CONTENT_VISUAL":
        addContentVisual(slide, slideData, colors);
        break;
      case "DATA_HIGHLIGHT":
        addDataHighlight(slide, slideData, colors);
        break;
      case "CLOSING":
        addClosingContent(slide, slideData, colors);
        break;
    }
  }

  // Buffer出力
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

// ── 各スライドタイプの配置ロジック ──

function addCoverContent(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  // プレースホルダーに追加コンテンツがあれば配置
  // （マスタースライドで定義済みのプレースホルダーはaddSlide時に自動適用）
}

function addSectionContent(slide: PptxGenJS.Slide, data: SlideData) {
  // セクション区切りはマスターで完結
}

function addContent1Col(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  // 箇条書き
  if (Array.isArray(data.body)) {
    const textItems = data.body.map((item) => ({
      text: item,
      options: { bullet: { code: "2022" }, fontSize: 14, fontFace: "Noto Sans JP", breakLine: true },
    }));
    slide.addText(textItems as any, {
      x: 0.8, y: 1.5, w: 11.5, h: 5.0,
      valign: "top",
      color: colors.dark,
    });
  }

  // テーブル
  if (data.table) {
    addTable(slide, data.table, colors);
  }

  // チャート
  if (data.chart) {
    addChart(slide, data.chart, colors);
  }

  // 画像
  if (data.image) {
    slide.addImage({
      data: `image/png;base64,${data.image.data}`,
      x: 1.0, y: 1.5,
      w: data.image.w,
      h: data.image.h,
    });
  }
}

function addContent2Col(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  if (data.bodyLeft) {
    const items = Array.isArray(data.bodyLeft) ? data.bodyLeft : [data.bodyLeft];
    slide.addText(
      items.map((t) => ({ text: t, options: { fontSize: 13, breakLine: true } })) as any,
      { x: 0.8, y: 1.5, w: 5.4, h: 5.0, valign: "top", color: colors.dark }
    );
  }
  if (data.bodyRight) {
    const items = Array.isArray(data.bodyRight) ? data.bodyRight : [data.bodyRight];
    slide.addText(
      items.map((t) => ({ text: t, options: { fontSize: 13, breakLine: true } })) as any,
      { x: 6.8, y: 1.5, w: 5.4, h: 5.0, valign: "top", color: colors.dark }
    );
  }
}

function addContentVisual(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  if (data.image) {
    // 画像を中央配置（タイトルバー下から）
    slide.addImage({
      data: `image/png;base64,${data.image.data}`,
      x: 0.8, y: 1.5,
      w: data.image.w,
      h: data.image.h,
    });
  }
  if (data.chart) {
    addChart(slide, data.chart, colors, { x: 0.8, y: 1.5, w: 11.5, h: 5.5 });
  }
}

function addDataHighlight(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  if (data.kpiCards && data.kpiCards.length > 0) {
    const cardCount = data.kpiCards.length;
    const cardW = Math.min(3.0, 11.5 / cardCount - 0.3);
    const gap = (11.5 - cardW * cardCount) / (cardCount + 1);

    data.kpiCards.forEach((kpi, i) => {
      const x = 0.8 + gap + i * (cardW + gap);
      const cardColor = kpi.color || colors.primary;

      // KPIカード背景
      slide.addShape("rect" as any, {
        x, y: 2.0, w: cardW, h: 3.0,
        fill: { color: colors.white },
        line: { color: cardColor, width: 2 },
        rectRadius: 0.1,
      });

      // 数値
      slide.addText(kpi.value, {
        x, y: 2.3, w: cardW, h: 1.5,
        fontSize: 40, fontFace: "Noto Sans JP",
        color: cardColor, bold: true,
        align: "center", valign: "middle",
      });

      // 単位
      if (kpi.unit) {
        slide.addText(kpi.unit, {
          x, y: 3.5, w: cardW, h: 0.5,
          fontSize: 14, color: colors.gray,
          align: "center",
        });
      }

      // ラベル
      slide.addText(kpi.label, {
        x, y: 4.0, w: cardW, h: 0.8,
        fontSize: 12, color: colors.dark,
        align: "center", valign: "top",
      });
    });
  }
}

function addClosingContent(slide: PptxGenJS.Slide, data: SlideData, colors: ColorScheme) {
  if (Array.isArray(data.body)) {
    const textItems = data.body.map((item, i) => ({
      text: `${i + 1}. ${item}`,
      options: { fontSize: 16, fontFace: "Noto Sans JP", breakLine: true, lineSpacing: 28 },
    }));
    slide.addText(textItems as any, {
      x: 0.8, y: 1.8, w: 11.5, h: 4.5,
      valign: "top", color: colors.dark,
    });
  }
}

// ── 共通ヘルパー ──

function addTable(
  slide: PptxGenJS.Slide,
  table: { headers: string[]; rows: string[][] },
  colors: ColorScheme
) {
  const headerRow = table.headers.map((h) => ({
    text: h,
    options: {
      bold: true, fontSize: 12, fontFace: "Noto Sans JP",
      fill: { color: colors.primary }, color: colors.white,
      border: { type: "solid", pt: 0.5, color: colors.gray },
      margin: [5, 8, 5, 8],
    },
  }));

  const dataRows = table.rows.map((row) =>
    row.map((cell) => ({
      text: cell,
      options: {
        fontSize: 11, fontFace: "Noto Sans JP",
        border: { type: "solid", pt: 0.5, color: colors.lightGray },
        margin: [4, 8, 4, 8],
      },
    }))
  );

  slide.addTable([headerRow, ...dataRows] as any, {
    x: 0.8, y: 1.8, w: 11.5,
    colW: table.headers.map(() => 11.5 / table.headers.length),
    autoPage: true,
  });
}

function addChart(
  slide: PptxGenJS.Slide,
  chart: SlideData["chart"],
  colors: ColorScheme,
  position = { x: 1.5, y: 2.0, w: 10.0, h: 4.5 }
) {
  if (!chart) return;

  const chartColors = [colors.primary, colors.accent, "EA4335", "FBBC04", "9334E6", "FF6D01"];

  const chartTypeMap: Record<string, any> = {
    bar: "bar",
    line: "line",
    pie: "pie",
    doughnut: "doughnut",
    area: "area",
    radar: "radar",
  };

  slide.addChart(chartTypeMap[chart.type], chart.data as any, {
    ...position,
    showTitle: false,
    showValue: chart.type === "pie" || chart.type === "doughnut",
    showLegend: true,
    legendPos: "b",
    chartColors,
    ...chart.options,
  });
}
```

### 4.3 Next.js API Route

```typescript
// app/api/generate-pptx/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePptx, PresentationData } from "@/lib/pptx/generator";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const data: PresentationData = await request.json();

    // pptx生成
    const buffer = await generatePptx(data);

    // Supabase Storageにアップロード
    const fileName = `presentations/${data.title.replace(/\s+/g, "_")}_${Date.now()}.pptx`;
    const { error: uploadError } = await supabase.storage
      .from("generated-files")
      .upload(fileName, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 署名付きURL生成（1時間有効）
    const { data: urlData } = await supabase.storage
      .from("generated-files")
      .createSignedUrl(fileName, 3600);

    return NextResponse.json({
      success: true,
      downloadUrl: urlData?.signedUrl,
      fileName,
    });
  } catch (error) {
    console.error("PPTX generation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate presentation" },
      { status: 500 }
    );
  }
}
```

### 4.4 Claude APIからの出力をSlideDataに変換するプロンプト例

```typescript
// lib/prompts/slide-structure.ts
export const SLIDE_STRUCTURE_PROMPT = `
あなたは企画提案書のスライド構造を設計するエキスパートです。
以下の構成情報をもとに、各ページの詳細データをJSON形式で出力してください。

## 利用可能なマスタースライド

| masterName | 用途 |
|-----------|------|
| COVER | 表紙。title, subtitle を設定 |
| SECTION | セクション区切り。title のみ |
| CONTENT_1COL | 1カラム本文。title + body（テキスト or 箇条書き配列）。table, chart, image も配置可能 |
| CONTENT_2COL | 2カラム。title + bodyLeft + bodyRight |
| CONTENT_VISUAL | 図表メイン。title + image or chart |
| DATA_HIGHLIGHT | KPI・数値強調。title + kpiCards配列 |
| CLOSING | まとめ / Next Steps。title + body |

## 出力形式

以下のJSON配列を返してください：

\`\`\`json
{
  "title": "プレゼンテーションタイトル",
  "slides": [
    {
      "masterName": "COVER",
      "title": "提案タイトル",
      "subtitle": "株式会社○○ 御中 | 2026年2月",
      "notes": "ご挨拶と本日のアジェンダを説明"
    },
    {
      "masterName": "CONTENT_1COL",
      "title": "市場環境の変化",
      "body": [
        "国内市場は年率5%で成長を続けている",
        "競合他社のデジタル投資が加速",
        "顧客の購買行動がオンラインシフト"
      ],
      "notes": "市場データの出典は○○レポート2025年版"
    },
    {
      "masterName": "DATA_HIGHLIGHT",
      "title": "期待される効果",
      "kpiCards": [
        { "label": "売上成長率", "value": "+25%", "unit": "前年比" },
        { "label": "コスト削減", "value": "¥3.2M", "unit": "年間" },
        { "label": "業務効率化", "value": "40%", "unit": "工数削減" }
      ]
    }
  ]
}
\`\`\`

注意事項：
- 各スライドのtitleは「そのページのメインメッセージ」を1文で表現すること
- bodyが配列の場合は箇条書きとして表示される
- chartのdataは { name, labels, values } 形式で指定
- notesにはスピーカーノート（プレゼン時の補足説明）を記載
`;
```

---

## 5. インフォグラフィック生成の方針

### フロー

```
Claude API → HTML/SVGコード生成 → Playwright（スクリーンショット） → PNG → PptxGenJS埋め込み
```

### Vercel上での制約と対策

| 方式 | Vercel互換性 | 品質 | 対策 |
|------|-------------|------|------|
| Playwright（ヘッドレスChrome） | △ Serverlessでは重い | ◎ | Supabase Edge FunctionまたはAWS Lambda単体で分離 |
| Satori（Vercel製SVGレンダラー） | ◎ Vercel最適化済み | ○ | JSX → SVG変換。OGP画像用だがインフォグラフィックにも転用可能 |
| SVG直接生成 | ◎ | ○ | Claude APIにSVGコードを生成させ、そのままPptxGenJSに渡す |

**推奨：** Phase 1では**SVG直接生成**（Claudeが出力 → PptxGenJSのSVGサポートで埋め込み）で開始し、品質が不足すればPhase 2でSatoriまたはPlaywrightを追加。

---

## 6. PDF変換の方針

### 選択肢

| 方式 | 互換性 | 品質 | コスト |
|------|--------|------|--------|
| LibreOffice headless | Vercel× | ◎ | 別途サーバー必要 |
| CloudConvert API | ◎ | ◎ | 従量課金 |
| Gotenberg (Docker) | Vercel× | ◎ | セルフホスト |
| クライアント側で変換 | ◎ | △ | 無料 |

**推奨：** Phase 1では**pptxダウンロード**のみ。PDF必要時はCloudConvert APIまたは類似SaaSで変換。本格的にPDF出力が必要になった段階で、Gotenbergのコンテナを別途立てる。

---

## 7. 次のステップ

1. **PptxGenJSの実機検証**：上記プロトタイプコードをローカルで実行し、日本語表示・レイアウト・チャートの品質を確認
2. **Claude API → JSON → pptxのE2E検証**：実際のプロンプトでClaude APIを呼び、出力JSONからpptxを生成するパイプラインを通す
3. **SVGインフォグラフィックの品質検証**：Claudeが生成するSVGの品質とPptxGenJSでの埋め込み結果を確認
4. **Vercelデプロイ検証**：API Routeでの生成時間・メモリ使用量を計測
