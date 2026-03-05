import type { SlideTemplate } from "../template-types";

/* ─── Cover Templates ─── */

export const coverCentered: SlideTemplate = {
  id: "cover-centered",
  name: "表紙：中央配置",
  description: "タイトルとサブタイトルを中央に配置。最も標準的な表紙。",
  category: "cover",
  html: `<div class="slide slide--navy" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:16px;">
  <img src="/logo2.png" alt="" style="position:absolute; top:32px; left:40px; height:112px; width:auto;" />
  <h1 class="cover-title" style="color:var(--white);">{{title}}</h1>
  <div class="accent-line" style="margin:0 auto;"></div>
  <p class="cover-subtitle" style="color:var(--white); opacity:0.85;">{{subtitle}}</p>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 40, required: true },
    { name: "subtitle", label: "サブタイトル", type: "text", maxChars: 60, required: true },
  ],
  constraints: { maxTotalChars: 100 },
};

export const coverLeftAligned: SlideTemplate = {
  id: "cover-left-aligned",
  name: "表紙：左寄せ",
  description: "タイトルを左に配置。落ち着いたモダンな印象。",
  category: "cover",
  html: `<div class="slide slide--navy" style="display:flex; flex-direction:column; justify-content:center; align-items:flex-start;">
  <img src="/logo2.png" alt="" style="position:absolute; top:32px; left:40px; height:112px; width:auto;" />
  <div style="max-width:620px;">
    <h1 class="cover-title" style="color:var(--white); margin-bottom:16px; text-align:left;">{{title}}</h1>
    <div class="accent-line" style="margin-bottom:16px;"></div>
    <p class="cover-subtitle" style="color:var(--white); opacity:0.85; text-align:left;">{{subtitle}}</p>
    <p class="caption" style="color:var(--beige); margin-top:24px; text-align:left;">{{date}}</p>
  </div>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 40, required: true },
    { name: "subtitle", label: "サブタイトル", type: "text", maxChars: 60, required: true },
    { name: "date", label: "日付・補足", type: "text", maxChars: 30, required: false },
  ],
  constraints: { maxTotalChars: 130 },
};

export const coverBold: SlideTemplate = {
  id: "cover-bold",
  name: "表紙：大文字インパクト",
  description: "タイトルを大きく表示。インパクト重視の表紙。",
  category: "cover",
  html: `<div class="slide slide--navy" style="display:flex; flex-direction:column; justify-content:flex-end; padding-bottom:72px;">
  <img src="/logo2.png" alt="" style="position:absolute; top:32px; left:40px; height:112px; width:auto;" />
  <div style="position:absolute; top:48px; right:56px;">
    <span class="tag tag--green">{{tag}}</span>
  </div>
  <h1 class="cover-title" style="color:var(--white); font-size:42px; line-height:1.25; margin-bottom:16px; text-align:left;">{{title}}</h1>
  <div class="accent-line" style="margin-bottom:16px;"></div>
  <p class="cover-subtitle" style="color:var(--white); opacity:0.85; text-align:left;">{{subtitle}}</p>
</div>`,
  slots: [
    { name: "tag", label: "タグ", type: "text", maxChars: 15, required: false },
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "subtitle", label: "サブタイトル", type: "text", maxChars: 50, required: true },
  ],
  constraints: { maxTotalChars: 95 },
};

export const coverTemplates = [coverCentered, coverLeftAligned, coverBold];
