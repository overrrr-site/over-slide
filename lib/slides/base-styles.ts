/**
 * CSS Design System for HTML slides.
 *
 * Defines brand colors, typography, layout classes, and component styles.
 * This CSS is injected into every slide document and also embedded
 * in the AI prompt so Claude knows exactly which classes to use.
 *
 * Slide canvas: 960 x 540 px (16:9 aspect ratio)
 */

export const CSS_VERSION = "1.0.0";

export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;

export const BASE_STYLES = `
/* ─── Google Fonts ─── */
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Montserrat:wght@400;500;600;700&display=swap');

/* ─── CSS Variables (Brand Colors) ─── */
:root {
  --navy: #1A2B4A;
  --green: #6B8E7F;
  --beige: #E8D5C4;
  --off-white: #F9F7F4;
  --text-primary: #2A2A2A;
  --text-secondary: #666666;
  --white: #FFFFFF;

  --font-jp: 'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
  --font-en: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;

  --slide-w: ${SLIDE_WIDTH}px;
  --slide-h: ${SLIDE_HEIGHT}px;
}

/* ─── Reset ─── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

/* ─── Slide Container ─── */
.slide {
  width: var(--slide-w);
  height: var(--slide-h);
  position: relative;
  overflow: hidden;
  background: var(--off-white);
  font-family: var(--font-jp);
  color: var(--text-primary);
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
}

/* ─── Slide Backgrounds ─── */
.slide--navy { background: var(--navy); color: var(--white); }
.slide--green { background: var(--green); color: var(--white); }
.slide--beige { background: var(--beige); color: var(--text-primary); }
.slide--white { background: var(--white); color: var(--text-primary); }

/* ─── Typography ─── */
.cover-title {
  font-family: var(--font-jp);
  font-size: 36px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.02em;
  color: inherit;
}

.cover-subtitle {
  font-family: var(--font-jp);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.5;
  color: inherit;
  opacity: 0.85;
}

/* Ensure text colors on dark slide backgrounds */
.slide--navy .cover-title,
.slide--navy .cover-subtitle,
.slide--navy .section-title { color: var(--white); }
.slide--green .cover-title,
.slide--green .cover-subtitle,
.slide--green .section-title { color: var(--white); }

/* Image placeholder */
.image-placeholder {
  background: var(--beige);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 13px;
  overflow: hidden;
  min-height: 180px;
}

.image-placeholder--full {
  width: 100%;
  height: 100%;
}

.section-title {
  font-family: var(--font-jp);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
}

.slide-title {
  font-family: var(--font-jp);
  font-size: 22px;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.4;
  margin-bottom: 20px;
}

.body-text {
  font-family: var(--font-jp);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.8;
  color: var(--text-primary);
}

.message-area {
  margin-bottom: 16px;
}

.key-message {
  font-family: var(--font-jp);
  font-size: 22px;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.4;
  margin-bottom: 4px;
}

.caption {
  font-family: var(--font-jp);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.kpi-value {
  font-family: var(--font-en);
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
}

.kpi-label {
  font-family: var(--font-jp);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 8px;
}

.kpi-unit {
  font-family: var(--font-jp);
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* ─── Title Bar (accent line under slide title) ─── */
.title-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 3px solid var(--navy);
}

.title-bar .slide-title { margin-bottom: 0; }

.title-bar--green { border-bottom-color: var(--green); }

/* ─── Layout: Grid Systems ─── */
.grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  flex: 1;
}

.grid-3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  flex: 1;
}

.grid-4col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 20px;
  flex: 1;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.flex-col-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ─── KPI Card ─── */
.kpi-card {
  background: var(--white);
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
  border: 2px solid var(--beige);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.kpi-card--navy { border-color: var(--navy); }
.kpi-card--navy .kpi-value { color: var(--navy); }

.kpi-card--green { border-color: var(--green); }
.kpi-card--green .kpi-value { color: var(--green); }

.kpi-grid {
  display: grid;
  gap: 20px;
  flex: 1;
  align-content: center;
}
.kpi-grid[data-count="2"] { grid-template-columns: 1fr 1fr; }
.kpi-grid[data-count="3"] { grid-template-columns: 1fr 1fr 1fr; }
.kpi-grid[data-count="4"] { grid-template-columns: 1fr 1fr 1fr 1fr; }

/* ─── Data Table ─── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th {
  background: var(--navy);
  color: var(--white);
  font-weight: 700;
  padding: 10px 14px;
  text-align: left;
  font-size: 12px;
}

.data-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--beige);
  font-size: 11px;
}

.data-table tr:nth-child(even) td {
  background: rgba(232, 213, 196, 0.15);
}

/* ─── Bullet List ─── */
.bullet-list {
  list-style: none;
  padding: 0;
}

.bullet-list li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.7;
}

.bullet-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}

/* ─── Numbered List ─── */
.numbered-list {
  list-style: none;
  padding: 0;
  counter-reset: item;
}

.numbered-list li {
  position: relative;
  padding-left: 32px;
  margin-bottom: 14px;
  font-size: 14px;
  line-height: 1.7;
  counter-increment: item;
}

.numbered-list li::before {
  content: counter(item);
  position: absolute;
  left: 0;
  top: 1px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--navy);
  color: var(--white);
  font-family: var(--font-en);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Info Box ─── */
.info-box {
  background: var(--white);
  border-left: 4px solid var(--green);
  border-radius: 0 8px 8px 0;
  padding: 16px 20px;
  margin: 12px 0;
}

.info-box--navy { border-left-color: var(--navy); }

/* ─── Chart Container (for SVG charts) ─── */
.chart-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.chart-container svg {
  max-width: 100%;
  max-height: 100%;
}

/* ─── Slide Number ─── */
.slide-number {
  position: absolute;
  bottom: 16px;
  right: 24px;
  font-family: var(--font-en);
  font-size: 10px;
  color: var(--text-secondary);
}

/* ─── Decorative Elements ─── */
.accent-line {
  width: 60px;
  height: 3px;
  background: var(--green);
  margin: 16px 0;
}

.accent-line--navy { background: var(--navy); }

.divider {
  width: 100%;
  height: 1px;
  background: var(--beige);
  margin: 16px 0;
}

/* ─── Tag / Badge ─── */
.tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--beige);
  color: var(--navy);
}

.tag--navy { background: var(--navy); color: var(--white); }
.tag--green { background: var(--green); color: var(--white); }

/* ─── Icon Circle ─── */
.icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--navy);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.icon-circle--green { background: var(--green); }
.icon-circle--beige { background: var(--beige); color: var(--navy); }

/* ─── Inline Icon (Iconify SVG) ─── */
.icon-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  width: 1.2em;
  height: 1.2em;
  flex-shrink: 0;
}
.icon-inline svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

/* ─── Statement (Mission/Vision) ─── */
.statement-label {
  font-family: var(--font-en);
  font-size: 14px;
  font-weight: 600;
  color: var(--green);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.statement-text {
  font-family: var(--font-jp);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--navy);
}

/* ─── Profile Table (Company Overview) ─── */
.profile-table {
  width: 100%;
}

.profile-table dt {
  font-size: 12px;
  font-weight: 700;
  color: var(--navy);
  padding: 10px 0 4px;
  border-top: 1px solid var(--beige);
}

.profile-table dt:first-child {
  border-top: none;
}

.profile-table dd {
  font-size: 13px;
  color: var(--text-primary);
  padding: 0 0 8px;
  margin-left: 0;
}

/* ─── Table of Contents ─── */
.toc-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--beige);
  font-size: 14px;
}

.toc-item:last-child {
  border-bottom: none;
}

.toc-number {
  font-family: var(--font-en);
  font-size: 18px;
  font-weight: 700;
  color: var(--navy);
  min-width: 28px;
}

.toc-title {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.toc-page {
  font-family: var(--font-en);
  font-size: 12px;
  color: var(--text-secondary);
}

.toc-line {
  flex: 1;
  border-bottom: 1px dotted var(--beige);
  margin: 0 8px;
}

.toc-sub {
  font-size: 12px;
  color: var(--text-secondary);
  padding-left: 40px;
  padding-top: 4px;
  padding-bottom: 4px;
}

/* ─── Timeline ─── */
.timeline-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 20px;
  flex: 1;
}

.timeline-track::before {
  content: '';
  position: absolute;
  top: 30px;
  left: 24px;
  right: 24px;
  height: 3px;
  background: var(--navy);
}

.timeline-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  z-index: 1;
  flex: 1;
}

.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--navy);
  border: 3px solid var(--off-white);
  margin-bottom: 12px;
}

.timeline-dot--active {
  background: var(--green);
}

.timeline-year {
  font-family: var(--font-en);
  font-size: 16px;
  font-weight: 700;
  color: var(--navy);
  margin-bottom: 6px;
}

.timeline-content {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.5;
  max-width: 120px;
}

/* ─── Person / Message ─── */
.person-area {
  display: flex;
  align-items: center;
  gap: 24px;
}

.person-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--navy);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-en);
  font-size: 28px;
  font-weight: 700;
  flex-shrink: 0;
}

.person-avatar--green {
  background: var(--green);
}

.person-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.person-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--navy);
}

.person-role {
  font-size: 12px;
  color: var(--text-secondary);
}

.person-message {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
  padding: 20px 24px;
  background: var(--white);
  border-radius: 12px;
  border: 1px solid var(--beige);
  position: relative;
  margin-top: 16px;
}

/* ─── Case Study ─── */
.case-study-card {
  display: flex;
  gap: 32px;
  flex: 1;
  align-items: center;
}

.case-study-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-study-image {
  width: 280px;
  height: 200px;
  background: var(--beige);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

/* ─── Print (PDF output) ─── */
@media print {
  @page {
    size: 254mm 142.88mm;
    margin: 0;
  }
  body { margin: 0; }
  .slide {
    page-break-after: always;
    page-break-inside: avoid;
  }
  .slide:last-child {
    page-break-after: auto;
  }
}
`;

/**
 * Color overrides for custom themes.
 */
export interface ColorOverrides {
  navy?: string;
  green?: string;
  beige?: string;
  offWhite?: string;
  textPrimary?: string;
  textSecondary?: string;
  white?: string;
}

/**
 * Build custom CSS overriding the default brand colors.
 */
function buildColorOverrideCSS(overrides: ColorOverrides): string {
  const vars: string[] = [];
  if (overrides.navy) vars.push(`--navy: #${overrides.navy};`);
  if (overrides.green) vars.push(`--green: #${overrides.green};`);
  if (overrides.beige) vars.push(`--beige: #${overrides.beige};`);
  if (overrides.offWhite) vars.push(`--off-white: #${overrides.offWhite};`);
  if (overrides.textPrimary) vars.push(`--text-primary: #${overrides.textPrimary};`);
  if (overrides.textSecondary) vars.push(`--text-secondary: #${overrides.textSecondary};`);
  if (overrides.white) vars.push(`--white: #${overrides.white};`);

  if (vars.length === 0) return "";
  return `\n:root { ${vars.join(" ")} }\n`;
}

/**
 * Build a complete HTML document wrapping all slides.
 * Used by the PDF converter and iframe preview.
 */
export function buildSlideDocument(
  slidesHtml: string[],
  colorOverrides?: ColorOverrides
): string {
  // NOTE: Each slide's HTML already contains `<div class="slide ...">...</div>`.
  // Do NOT wrap again in `.slide` — that would double-apply padding and clip content.
  const slidesDivs = slidesHtml
    .map(
      (html, i) =>
        `<div data-slide-index="${i}">\n${html}\n</div>`
    )
    .join("\n");

  const overrideCSS = colorOverrides ? buildColorOverrideCSS(colorOverrides) : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${SLIDE_WIDTH}">
  <style>${BASE_STYLES}${overrideCSS}</style>
</head>
<body style="margin:0;padding:0;">
${slidesDivs}
</body>
</html>`;
}

/**
 * Build an HTML document for a single slide (used for iframe preview).
 */
export function buildSingleSlideDocument(
  slideHtml: string,
  colorOverrides?: ColorOverrides
): string {
  const overrideCSS = colorOverrides ? buildColorOverrideCSS(colorOverrides) : "";

  // NOTE: slideHtml already contains `<div class="slide ...">...</div>`.
  // Do NOT wrap again in `.slide` — that would double-apply padding and clip content.
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${SLIDE_WIDTH}">
  <style>${BASE_STYLES}${overrideCSS}</style>
</head>
<body style="margin:0;padding:0;">
${slideHtml}
</body>
</html>`;
}
