import { getIconData, iconToSVG, iconToHTML } from "@iconify/utils";
import { icons as mdiIcons } from "@iconify-json/mdi";

/**
 * Resolve an Iconify icon name to an SVG string.
 * Supports "mdi:chart-line" style names.
 */
export function resolveIconSvg(
  iconName: string,
  color = "1A2B4A",
  size = 24
): string | null {
  const [prefix, name] = iconName.split(":");
  if (!prefix || !name) return null;

  const collections: Record<string, typeof mdiIcons> = {
    mdi: mdiIcons,
  };

  const collection = collections[prefix];
  if (!collection) return null;

  const iconData = getIconData(collection, name);
  if (!iconData) return null;

  const renderData = iconToSVG(iconData, {
    height: size,
    width: size,
  });

  const svgBody = iconToHTML(renderData.body, renderData.attributes);

  // Inject color
  return svgBody.replace("<svg ", `<svg fill="#${color}" `);
}

/**
 * Convert SVG string to base64 data URI for embedding in PPTX.
 */
export function svgToBase64(svg: string): string {
  return Buffer.from(svg).toString("base64");
}

/**
 * Resolve icon and return as base64 PNG using sharp.
 * Falls back to SVG base64 if sharp conversion fails.
 */
export async function resolveIconPng(
  iconName: string,
  color = "1A2B4A",
  size = 48
): Promise<{ data: string; type: "png" | "svg" } | null> {
  const svg = resolveIconSvg(iconName, color, size);
  if (!svg) return null;

  try {
    const sharp = (await import("sharp")).default;
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();

    return {
      data: pngBuffer.toString("base64"),
      type: "png",
    };
  } catch {
    // Fallback to SVG base64
    return {
      data: svgToBase64(svg),
      type: "svg",
    };
  }
}
