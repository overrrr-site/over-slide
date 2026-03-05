import type { SlideTemplate } from "../template-types";

/* ─── Section Templates ─── */

export const sectionCentered: SlideTemplate = {
  id: "section-centered",
  name: "セクション：中央配置",
  description: "セクションタイトルと説明を中央に。標準的なセクション区切り。",
  category: "section",
  html: `<div class="slide slide--green flex-col-center" style="text-align:center; gap:12px;">
  <h2 class="section-title">{{title}}</h2>
  <p class="body-text" style="color:var(--white); opacity:0.85; max-width:600px;">{{description}}</p>
</div>`,
  slots: [
    { name: "title", label: "セクション名", type: "text", maxChars: 25, required: true },
    { name: "description", label: "説明文", type: "text", maxChars: 60, required: false },
  ],
  constraints: { maxTotalChars: 85 },
};

export const sectionNumbered: SlideTemplate = {
  id: "section-numbered",
  name: "セクション：番号付き",
  description: "セクション番号を大きく表示。進行感を演出。",
  category: "section",
  html: `<div class="slide slide--green" style="display:flex; flex-direction:row; align-items:center; justify-content:flex-start; gap:48px;">
  <div style="flex-shrink:0;">
    <div style="font-family:var(--font-en); font-size:96px; font-weight:700; color:var(--white); line-height:1; opacity:0.25;">{{number}}</div>
  </div>
  <div>
    <h2 class="section-title" style="color:var(--white); margin-bottom:8px;">{{title}}</h2>
    <p class="body-text" style="color:rgba(255,255,255,0.85);">{{description}}</p>
  </div>
</div>`,
  slots: [
    { name: "number", label: "番号", type: "text", maxChars: 2, required: true },
    { name: "title", label: "セクション名", type: "text", maxChars: 25, required: true },
    { name: "description", label: "説明文", type: "text", maxChars: 60, required: false },
  ],
  constraints: { maxTotalChars: 87 },
};

export const sectionIconAccent: SlideTemplate = {
  id: "section-icon-accent",
  name: "セクション：アイコン付き",
  description: "アイコンとタイトルで視覚的にセクションを区切る。",
  category: "section",
  html: `<div class="slide slide--green flex-col-center" style="text-align:center; gap:20px;">
  <div class="icon-circle" style="width:64px; height:64px; font-size:28px; background:var(--white); color:var(--green);">{{icon:mdi:{{icon}}}}</div>
  <h2 class="section-title">{{title}}</h2>
  <p class="body-text" style="color:var(--white); opacity:0.85; max-width:560px;">{{description}}</p>
</div>`,
  slots: [
    { name: "icon", label: "アイコン名", type: "icon", required: false },
    { name: "title", label: "セクション名", type: "text", maxChars: 25, required: true },
    { name: "description", label: "説明文", type: "text", maxChars: 60, required: false },
  ],
  constraints: { maxTotalChars: 85 },
};

/* ─── Statement (migrated from statement.ts → section layout) ─── */

export const sectionStatement: SlideTemplate = {
  id: "section-statement",
  name: "セクション：ステートメント",
  description: "ラベル＋大きなテキスト＋補足文を中央配置。ミッション・ビジョン表現に。",
  category: "section",
  html: `<div class="slide slide--navy flex-col-center" style="text-align:center; gap:12px;">
  <p class="statement-label" style="color:var(--beige);">{{label}}</p>
  <p class="statement-text" style="color:var(--white); max-width:700px;">{{statement}}</p>
  <div class="accent-line" style="background:var(--green); margin:12px auto;"></div>
  <p class="body-text" style="color:rgba(255,255,255,0.7); max-width:700px;">{{description}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "label", label: "ラベル（Mission等）", type: "text", maxChars: 15, required: true },
    { name: "statement", label: "ステートメント", type: "text", maxChars: 60, required: true },
    { name: "description", label: "補足説明", type: "text", maxChars: 80, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 155 },
};

export const sectionTemplates = [sectionCentered, sectionNumbered, sectionIconAccent, sectionStatement];
