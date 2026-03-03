import { resolveIconSvg } from "@/lib/pptx/icons";

/**
 * Resolve {{icon:prefix:name}} placeholders in HTML to inline SVG.
 *
 * The AI outputs placeholders like `{{icon:mdi:chart-line}}` in the HTML.
 * This function replaces them with actual inline SVG using the existing
 * icon resolution from @iconify-json/mdi.
 *
 * The SVG uses `fill="currentColor"` so it inherits the parent element's
 * text color, making it work with both light and dark slide backgrounds.
 */
export function resolveIconPlaceholders(html: string): string {
  return html.replace(
    /\{\{icon:([a-z0-9-]+):([a-z0-9-]+)\}\}/gi,
    (_match, prefix: string, name: string) => {
      const svg = resolveIconSvg(`${prefix}:${name}`, "currentColor", 24);
      if (!svg) {
        // Return empty span if icon not found
        return `<span class="icon-inline" title="${prefix}:${name}"></span>`;
      }
      // Replace hardcoded fill color with currentColor for CSS inheritance
      const inlineSvg = svg
        .replace(/fill="#currentColor"/g, 'fill="currentColor"')
        .replace(/fill="#[0-9a-fA-F]+"/g, 'fill="currentColor"');
      return `<span class="icon-inline">${inlineSvg}</span>`;
    }
  );
}

/**
 * Resolve icon placeholders in all slides of an array.
 */
export function resolveAllSlideIcons<
  T extends { html: string },
>(slides: T[]): T[] {
  return slides.map((slide) => ({
    ...slide,
    html: resolveIconPlaceholders(slide.html),
  }));
}
