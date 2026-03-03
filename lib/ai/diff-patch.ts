function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Recursively applies an object patch.
 * - primitives and arrays are replaced
 * - plain objects are merged recursively
 */
export function applyObjectPatch<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;

  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const patchObj = patch as Record<string, unknown>;

  for (const [key, value] of Object.entries(patchObj)) {
    const current = merged[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      merged[key] = applyObjectPatch(current, value);
      continue;
    }
    merged[key] = value;
  }

  return merged as T;
}

export type NumberedPatch = {
  page_number?: number;
  slideNumber?: number;
  changes?: Record<string, unknown>;
  [key: string]: unknown;
};

export function patchByPageNumber<T extends { page_number: number }>(
  pages: T[],
  patches: NumberedPatch[]
): T[] {
  const patchMap = new Map<number, NumberedPatch>();
  for (const patch of patches) {
    if (typeof patch.page_number === "number") {
      patchMap.set(patch.page_number, patch);
    }
  }

  return pages.map((page) => {
    const patch = patchMap.get(page.page_number);
    if (!patch) return page;

    const rawPatch = patch.changes ?? patch;
    const rest = { ...rawPatch };
    delete (rest as { page_number?: unknown }).page_number;
    const merged = applyObjectPatch(page, rest);
    return {
      ...merged,
      page_number: page.page_number,
    } as T;
  });
}

export function patchBySlideNumber<T>(
  slides: T[],
  patches: NumberedPatch[],
  getSlideNumber: (slide: T, index: number) => number
): T[] {
  const patchMap = new Map<number, NumberedPatch>();
  for (const patch of patches) {
    if (typeof patch.slideNumber === "number") {
      patchMap.set(patch.slideNumber, patch);
    }
  }

  return slides.map((slide, index) => {
    const slideNumber = getSlideNumber(slide, index);
    const patch = patchMap.get(slideNumber);
    if (!patch) return slide;

    const rawPatch = patch.changes ?? patch;
    const rest = { ...rawPatch };
    delete (rest as { slideNumber?: unknown }).slideNumber;
    return applyObjectPatch(slide, rest);
  });
}
