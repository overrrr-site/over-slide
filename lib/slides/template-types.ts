/**
 * Slide template definitions.
 *
 * Templates provide pre-designed HTML layouts with content slots.
 * AI selects a template and fills in content, rather than generating
 * HTML from scratch. This ensures layout stability and design quality.
 */

import type { SlideType } from "./types";

/* ─── Slot definitions ─── */

export type SlotType =
  | "text" // plain text (title, subtitle, body paragraph)
  | "list" // bullet or numbered list items
  | "table" // rows × cols data
  | "kpi" // value + label + optional unit
  | "chart" // chart data (bar/pie/line)
  | "image" // image URL or HTML (logo, photo)
  | "icon"; // MDI icon name

export interface SlotDefinition {
  /** Slot name used in HTML placeholder, e.g. "title", "body", "bullets" */
  name: string;
  /** Display label (Japanese) */
  label: string;
  /** Content type */
  type: SlotType;
  /** Max characters (for text/list item) */
  maxChars?: number;
  /** Max items (for list/kpi/table rows) */
  maxItems?: number;
  /** Whether AI must fill this slot */
  required: boolean;
}

/* ─── Template definition ─── */

export interface SlideTemplate {
  /** Unique ID, e.g. "cover-centered", "content-bullets-icon" */
  id: string;
  /** Display name (Japanese) */
  name: string;
  /** Brief description of when to use this template */
  description: string;
  /** Which slide category this belongs to */
  category: SlideType;
  /** HTML with {{slot_name}} placeholders */
  html: string;
  /** Slot definitions */
  slots: SlotDefinition[];
  /** Overall constraints */
  constraints: {
    /** Max total text characters for the whole slide */
    maxTotalChars?: number;
  };
}

/* ─── Template registry ─── */

export interface TemplateRegistry {
  /** All templates indexed by id */
  templates: Record<string, SlideTemplate>;
  /** Templates grouped by category */
  byCategory: Record<SlideType, SlideTemplate[]>;
}
