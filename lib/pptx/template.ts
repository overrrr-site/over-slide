import PptxGenJS from "pptxgenjs";
import { COLORS, FONTS, TYPOGRAPHY } from "@/lib/utils/constants";

export interface ColorScheme {
  navy: string;
  green: string;
  beige: string;
  offWhite: string;
  textPrimary: string;
  textSecondary: string;
  white: string;
}

export const DEFAULT_COLORS: ColorScheme = { ...COLORS };

export function defineTemplate(
  pptx: PptxGenJS,
  colors: ColorScheme = DEFAULT_COLORS
) {
  pptx.layout = "LAYOUT_WIDE"; // 16:9 (13.33" x 7.5")
  pptx.author = "OVERworks";
  pptx.theme = { headFontFace: FONTS.jp, bodyFontFace: FONTS.jp };

  // ── 1. COVER ──
  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: colors.navy },
    objects: [
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: 0.8,
            y: 2.0,
            w: 11.5,
            h: 2.0,
            fontFace: TYPOGRAPHY.coverTitle.font,
            fontSize: TYPOGRAPHY.coverTitle.size,
            color: colors.white,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "subtitle",
            type: "body",
            x: 0.8,
            y: 4.2,
            w: 11.5,
            h: 0.8,
            fontFace: TYPOGRAPHY.coverSubtitle.font,
            fontSize: TYPOGRAPHY.coverSubtitle.size,
            color: colors.offWhite,
          },
          text: "",
        },
      },
      {
        text: {
          text: "CONFIDENTIAL",
          options: {
            x: 0.8,
            y: 6.8,
            w: 3,
            h: 0.4,
            fontFace: TYPOGRAPHY.confidential.font,
            fontSize: TYPOGRAPHY.confidential.size,
            color: colors.textSecondary,
          },
        },
      },
    ],
  });

  // ── 2. SECTION ──
  pptx.defineSlideMaster({
    title: "SECTION",
    background: { color: colors.navy },
    objects: [
      {
        rect: {
          x: 0.5,
          y: 3.4,
          w: 2.0,
          h: 0.06,
          fill: { color: colors.green },
        },
      },
      {
        placeholder: {
          options: {
            name: "sectionTitle",
            type: "title",
            x: 0.5,
            y: 1.8,
            w: 12.0,
            h: 1.5,
            fontFace: TYPOGRAPHY.sectionTitle.font,
            fontSize: TYPOGRAPHY.sectionTitle.size,
            color: colors.white,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "sectionDesc",
            type: "body",
            x: 0.5,
            y: 3.8,
            w: 8.0,
            h: 1.0,
            fontFace: FONTS.jp,
            fontSize: 16,
            color: colors.offWhite,
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });

  // ── 3. CONTENT_1COL ──
  pptx.defineSlideMaster({
    title: "CONTENT_1COL",
    background: { color: colors.offWhite },
    objects: [
      // Title bar (Beige)
      {
        rect: {
          x: 0,
          y: 0,
          w: "100%",
          h: 1.2,
          fill: { color: colors.beige },
        },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8,
            y: 0.2,
            w: 11.5,
            h: 0.8,
            fontFace: TYPOGRAPHY.slideTitle.font,
            fontSize: TYPOGRAPHY.slideTitle.size,
            bold: true,
            color: colors.navy,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.8,
            y: 1.5,
            w: 11.5,
            h: 5.0,
            fontFace: TYPOGRAPHY.bodyText.font,
            fontSize: TYPOGRAPHY.bodyText.size,
            color: colors.textPrimary,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });

  // ── 4. CONTENT_2COL ──
  pptx.defineSlideMaster({
    title: "CONTENT_2COL",
    background: { color: colors.offWhite },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: "100%",
          h: 1.2,
          fill: { color: colors.beige },
        },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8,
            y: 0.2,
            w: 11.5,
            h: 0.8,
            fontFace: TYPOGRAPHY.slideTitle.font,
            fontSize: TYPOGRAPHY.slideTitle.size,
            bold: true,
            color: colors.navy,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "bodyLeft",
            type: "body",
            x: 0.8,
            y: 1.5,
            w: 5.4,
            h: 5.0,
            fontFace: TYPOGRAPHY.bodyText.font,
            fontSize: TYPOGRAPHY.bodyText.size,
            color: colors.textPrimary,
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
            x: 6.8,
            y: 1.5,
            w: 5.4,
            h: 5.0,
            fontFace: TYPOGRAPHY.bodyText.font,
            fontSize: TYPOGRAPHY.bodyText.size,
            color: colors.textPrimary,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });

  // ── 5. CONTENT_VISUAL ──
  pptx.defineSlideMaster({
    title: "CONTENT_VISUAL",
    background: { color: colors.offWhite },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: "100%",
          h: 1.2,
          fill: { color: colors.beige },
        },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8,
            y: 0.2,
            w: 11.5,
            h: 0.8,
            fontFace: TYPOGRAPHY.slideTitle.font,
            fontSize: TYPOGRAPHY.slideTitle.size,
            bold: true,
            color: colors.navy,
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });

  // ── 6. DATA_HIGHLIGHT ──
  pptx.defineSlideMaster({
    title: "DATA_HIGHLIGHT",
    background: { color: colors.offWhite },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: "100%",
          h: 1.2,
          fill: { color: colors.beige },
        },
      },
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8,
            y: 0.2,
            w: 11.5,
            h: 0.8,
            fontFace: TYPOGRAPHY.slideTitle.font,
            fontSize: TYPOGRAPHY.slideTitle.size,
            bold: true,
            color: colors.navy,
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });

  // ── 7. CLOSING ──
  pptx.defineSlideMaster({
    title: "CLOSING",
    background: { color: colors.beige },
    objects: [
      {
        placeholder: {
          options: {
            name: "slideTitle",
            type: "title",
            x: 0.8,
            y: 0.5,
            w: 11.5,
            h: 1.0,
            fontFace: FONTS.jp,
            fontSize: 28,
            bold: true,
            color: colors.navy,
          },
          text: "Next Steps",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.8,
            y: 1.8,
            w: 11.5,
            h: 4.5,
            fontFace: FONTS.jp,
            fontSize: 16,
            color: colors.textPrimary,
            valign: "top",
          },
          text: "",
        },
      },
    ],
    slideNumber: {
      x: 12.0,
      y: 7.0,
      fontFace: FONTS.en,
      color: colors.textSecondary,
      fontSize: 10,
    },
  });
}
