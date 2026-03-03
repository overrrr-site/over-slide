type QuoteRequestBody = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asTruthyNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildQuoteRecordPayload(body: QuoteRequestBody) {
  return {
    origin_brainstorm_id: asNullableString(body.originBrainstormId),
    orient_sheet_markdown: asString(body.orientSheetMarkdown),
    quote_number: asString(body.quoteNumber),
    client_name: asString(body.clientName),
    project_name: asString(body.projectName),
    project_types: asStringArray(body.projectTypes),
    status: asNonEmptyString(body.status, "draft"),
    issued_at: asString(body.issuedAt),
    expires_at: asString(body.expiresAt),
    subtotal: asNumber(body.subtotal),
    tax: asNumber(body.tax),
    total: asNumber(body.total),
    notes: asArray(body.notes),
    assigned_sales: asNullableString(body.assignedSales),
  };
}

export function buildQuoteItemRows(quoteId: string, items: unknown[]) {
  return asArray(items).map((rawItem, index) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    return {
      quote_id: quoteId,
      sort_order: index,
      category: asString(item.category),
      name: asString(item.name),
      description: asString(item.description),
      unit_price: asNumber(item.unitPrice),
      quantity: asTruthyNumber(item.quantity, 1),
      unit: asNonEmptyString(item.unit, "式"),
      amount: asNumber(item.amount),
    };
  });
}
