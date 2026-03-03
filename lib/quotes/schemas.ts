import { z } from "zod";

export const quoteItemInputSchema = z.object({
  category: z.string().optional().default(""),
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  unitPrice: z.coerce.number().optional().default(0),
  quantity: z.coerce.number().optional().default(1),
  unit: z.string().optional().default("式"),
  amount: z.coerce.number().optional().default(0),
});

export const quoteUpsertRequestSchema = z.object({
  quoteNumber: z.string().optional().default(""),
  clientName: z.string().optional().default(""),
  projectName: z.string().optional().default(""),
  originBrainstormId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .default(""),
  orientSheetMarkdown: z.string().optional().default(""),
  projectTypes: z.array(z.string()).optional().default([]),
  status: z.enum(["draft", "submitted", "won", "lost"]).optional().default("draft"),
  issuedAt: z.string().optional().default(""),
  expiresAt: z.string().optional().default(""),
  subtotal: z.coerce.number().optional().default(0),
  tax: z.coerce.number().optional().default(0),
  total: z.coerce.number().optional().default(0),
  notes: z.array(z.unknown()).optional().default([]),
  assignedSales: z.union([z.string(), z.null()]).optional().default(""),
  items: z.array(quoteItemInputSchema).optional().default([]),
});
