import { z } from "zod";
import { PROJECT_TYPES } from "./constants";

export const quoteWorkspaceItemSchema = z.object({
  category: z.string().default(""),
  name: z.string().default(""),
  description: z.string().optional().default(""),
  unitPrice: z.coerce.number().default(0),
  quantity: z.coerce.number().default(1),
  unit: z.string().default("式"),
});

export const quoteWorkspaceReferenceMaterialSchema = z.object({
  id: z.string().optional().default(""),
  title: z.string().optional().default(""),
  fileType: z.enum(["pdf", "docx"]).optional().default("pdf"),
  text: z.string().optional().default(""),
});

export const quoteWorkspaceRequestSchema = z.object({
  mode: z.enum(["initial", "revise"]),
  orientSheetMarkdown: z.string().optional().default(""),
  projectTypes: z.array(z.string()).optional().default([]),
  currentItems: z.array(quoteWorkspaceItemSchema).optional().default([]),
  draftItems: z.array(quoteWorkspaceItemSchema).optional().default([]),
  referenceMaterials: z.array(quoteWorkspaceReferenceMaterialSchema).optional().default([]),
  instruction: z.string().optional().default(""),
});

export const quoteWorkspaceResponseSchema = z.object({
  suggestedProjectTypes: z.array(z.string()).default([]),
  confidence: z.number().optional().default(0.5),
  rationale: z.string().default(""),
  items: z.array(quoteWorkspaceItemSchema).default([]),
});

export type QuoteWorkspaceItem = z.infer<typeof quoteWorkspaceItemSchema>;
export type QuoteWorkspaceReferenceMaterial = z.infer<
  typeof quoteWorkspaceReferenceMaterialSchema
>;

const ALLOWED_PROJECT_TYPE_IDS = new Set(PROJECT_TYPES.map((type) => type.id));

export function sanitizeWorkspaceProjectTypeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const id of ids) {
    const value = id.trim();
    if (!value || !ALLOWED_PROJECT_TYPE_IDS.has(value) || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }

  return next;
}

export function normalizeQuoteWorkspaceItems(raw: unknown): QuoteWorkspaceItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const parsed = quoteWorkspaceItemSchema.safeParse(item);
      if (!parsed.success) return null;

      const normalized = {
        ...parsed.data,
        category: parsed.data.category.trim(),
        name: parsed.data.name.trim(),
        description: (parsed.data.description || "").trim(),
        unit: parsed.data.unit.trim() || "式",
      };

      if (!normalized.category || !normalized.name) return null;
      return normalized;
    })
    .filter((item): item is QuoteWorkspaceItem => item !== null);
}
