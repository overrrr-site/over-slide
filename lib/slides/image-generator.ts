import { generateText, generateImage } from "ai";
import { sonnet, geminiImage } from "@/lib/ai/anthropic";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { createClient } from "@/lib/supabase/server";
import type { HtmlSlide } from "./types";

/** Describes which slide needs an image and how */
export interface ImageNeed {
  slideIndex: number;
  prompt: string;
  placement: "right" | "left" | "background" | "inline";
}

/**
 * Step 1: Analyze which slides would benefit from images.
 * Uses Claude Sonnet to decide autonomously.
 */
export async function analyzeSlideImageNeeds(
  slides: HtmlSlide[]
): Promise<ImageNeed[]> {
  const slidesSummary = slides.map((s, i) => ({
    index: i,
    title: s.title,
    slideType: s.slideType,
    htmlExcerpt: s.html.substring(0, 200),
  }));

  const { text } = await generateText({
    model: sonnet,
    prompt: `以下のスライド一覧を分析し、コンセプトイメージや写真を追加すると見栄えが向上するスライドを選んでください。

スライド一覧:
${compactJsonForPrompt(slidesSummary)}

ルール:
- cover, section, closing タイプのスライドには画像を追加しない
- テキスト中心の content, two-column, data スライドが対象
- 最大5枚まで選定
- 画像プロンプトは英語で記述
- プロンプトに文字・テキスト情報を絶対に含めない（No text, no words, no letters, no numbers, no labels）
- 写真風かイラスト風か明記する
- placement は right, left, background, inline のいずれか

JSON形式のみ出力（説明不要）:
{
  "imageNeeds": [
    { "slideIndex": 2, "prompt": "Professional modern office space ...", "placement": "right" }
  ]
}`,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      imageNeeds?: ImageNeed[];
    };
    return (parsed.imageNeeds || []).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Step 2: Generate a single image using Gemini.
 */
export async function generateSlideImage(
  prompt: string,
  signal?: AbortSignal
): Promise<{ base64: string; mediaType: string }> {
  const fullPrompt = `${prompt}. Absolutely no text, words, letters, numbers, or labels in the image. Clean professional style suitable for business presentations.`;

  const result = await generateImage({
    model: geminiImage,
    prompt: fullPrompt,
    n: 1,
    aspectRatio: "16:9",
    abortSignal: signal,
  });

  return {
    base64: result.image.base64,
    mediaType: result.image.mediaType,
  };
}

/**
 * Step 3: Upload image to Supabase Storage and return a signed URL.
 */
export async function uploadSlideImage(
  teamId: string,
  projectId: string,
  slideIndex: number,
  imageData: { base64: string; mediaType: string }
): Promise<string> {
  const supabase = await createClient();
  const ext = imageData.mediaType === "image/jpeg" ? "jpg" : "png";
  const path = `${teamId}/${projectId}/slide-images/slide-${slideIndex}.${ext}`;

  // Convert base64 to buffer
  const buffer = Buffer.from(imageData.base64, "base64");

  const { error } = await supabase.storage.from("generated").upload(path, buffer, {
    contentType: imageData.mediaType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  // Get signed URL (7 days)
  const { data: signedUrl } = await supabase.storage
    .from("generated")
    .createSignedUrl(path, 7 * 24 * 3600);

  if (!signedUrl?.signedUrl) {
    throw new Error("Failed to create signed URL");
  }

  return signedUrl.signedUrl;
}

/**
 * Step 4: Embed an image into slide HTML.
 */
export function embedImageInSlideHtml(
  slide: HtmlSlide,
  imageUrl: string,
  placement: ImageNeed["placement"]
): HtmlSlide {
  const imgStyle = (() => {
    switch (placement) {
      case "right":
        return 'position:absolute;right:30px;top:50%;transform:translateY(-50%);max-width:320px;max-height:340px;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);';
      case "left":
        return 'position:absolute;left:30px;top:50%;transform:translateY(-50%);max-width:320px;max-height:340px;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);';
      case "background":
        return 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.15;z-index:0;';
      case "inline":
      default:
        return 'max-width:280px;max-height:200px;object-fit:cover;border-radius:8px;margin-top:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);';
    }
  })();

  const imgTag = `<img src="${imageUrl}" alt="" style="${imgStyle}" />`;

  // For background placement, insert at the beginning of the slide
  if (placement === "background") {
    return {
      ...slide,
      html: imgTag + slide.html,
    };
  }

  // For other placements, append at the end of the slide content
  return {
    ...slide,
    html: slide.html + imgTag,
  };
}

/**
 * Main pipeline: Analyze slides → Generate images → Upload → Embed.
 * Non-critical: returns original slides if anything fails.
 */
export async function generateAndEmbedImages(
  slides: HtmlSlide[],
  teamId: string,
  projectId: string,
  signal?: AbortSignal
): Promise<HtmlSlide[]> {
  // Step 1: Analyze which slides need images
  const imageNeeds = await analyzeSlideImageNeeds(slides);
  if (imageNeeds.length === 0) {
    console.log("[image-generator] No slides need images");
    return slides;
  }

  console.log(
    `[image-generator] Generating ${imageNeeds.length} images for project ${projectId}`
  );

  // Step 2-3: Generate + upload images in parallel
  const imageResults = await Promise.allSettled(
    imageNeeds.map(async (need) => {
      const imageData = await generateSlideImage(need.prompt, signal);
      const url = await uploadSlideImage(
        teamId,
        projectId,
        need.slideIndex,
        imageData
      );
      return { ...need, url };
    })
  );

  // Step 4: Embed successful images into slides
  const successfulImages = imageResults
    .filter(
      (r): r is PromiseFulfilledResult<ImageNeed & { url: string }> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);

  const failedCount = imageResults.filter(
    (r) => r.status === "rejected"
  ).length;
  if (failedCount > 0) {
    console.warn(
      `[image-generator] ${failedCount}/${imageNeeds.length} images failed to generate`
    );
  }

  if (successfulImages.length === 0) {
    return slides;
  }

  const imageMap = new Map(
    successfulImages.map((img) => [img.slideIndex, img])
  );

  const slidesWithImages = slides.map((slide) => {
    const img = imageMap.get(slide.index);
    if (img) {
      return embedImageInSlideHtml(slide, img.url, img.placement);
    }
    return slide;
  });

  console.log(
    `[image-generator] Embedded ${successfulImages.length} images into slides`
  );

  return slidesWithImages;
}
