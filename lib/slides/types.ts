/**
 * HTML slide types for the HTML → PDF generation pipeline.
 *
 * Each slide is a self-contained HTML fragment that renders at 960x540px (16:9).
 * The CSS design system (base-styles.ts) provides shared styling.
 */

export type SlideType =
  | "cover"
  | "section"
  | "content"
  | "two-column"
  | "visual"
  | "data"
  | "closing";

export interface HtmlSlide {
  /** 0-based index in the presentation */
  index: number;
  /** Full HTML content for this slide (inner content of .slide container) */
  html: string;
  /** Semantic slide type for categorization */
  slideType: SlideType;
  /** Slide title for preview / table of contents */
  title: string;
}

export interface HtmlPresentation {
  /** Presentation title */
  title: string;
  /** Ordered array of slides */
  slides: HtmlSlide[];
  /** CSS version hash — used to detect when re-generation is needed */
  cssVersion: string;
  /** Custom color overrides (from template_settings) */
  colorOverrides?: {
    navy?: string;
    green?: string;
    beige?: string;
    offWhite?: string;
    textPrimary?: string;
    textSecondary?: string;
    white?: string;
  };
}
