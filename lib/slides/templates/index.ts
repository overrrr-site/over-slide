import type { SlideType } from "../types";
import type { SlideTemplate, TemplateRegistry } from "../template-types";
import { coverTemplates } from "./cover";
import { sectionTemplates } from "./section";
import { contentTemplates } from "./content";
import { twoColumnTemplates } from "./two-column";
import { dataTemplates } from "./data";
import { closingTemplates } from "./closing";
import { tocTemplates } from "./toc";
import { threeColumnTemplates } from "./three-column";

/* ─── All templates ─── */

const ALL_TEMPLATES: SlideTemplate[] = [
  ...coverTemplates,
  ...sectionTemplates,
  ...contentTemplates,
  ...twoColumnTemplates,
  ...threeColumnTemplates,
  ...dataTemplates,
  ...tocTemplates,
  ...closingTemplates,
];

/* ─── Build registry ─── */

function buildRegistry(): TemplateRegistry {
  const templates: Record<string, SlideTemplate> = {};
  const byCategory: Record<SlideType, SlideTemplate[]> = {
    cover: [],
    section: [],
    content: [],
    "two-column": [],
    "three-column": [],
    data: [],
    toc: [],
    closing: [],
  };

  for (const t of ALL_TEMPLATES) {
    templates[t.id] = t;
    byCategory[t.category].push(t);
  }

  return { templates, byCategory };
}

export const registry = buildRegistry();

/** Get a template by ID */
export function getTemplate(id: string): SlideTemplate | undefined {
  return registry.templates[id];
}

/** Get all templates for a slide category */
export function getTemplatesForCategory(category: SlideType): SlideTemplate[] {
  return registry.byCategory[category] ?? [];
}

/** Get all template IDs */
export function getAllTemplateIds(): string[] {
  return ALL_TEMPLATES.map((t) => t.id);
}

/** Total template count */
export const TEMPLATE_COUNT = ALL_TEMPLATES.length;
