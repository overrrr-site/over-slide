import { generateText, generateImage } from "ai";
import { sonnet, geminiImage } from "@/lib/ai/anthropic";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { createClient } from "@/lib/supabase/server";
import type { HtmlSlide } from "./types";

/** Describes which slide needs an image and how */
export interface ImageNeed {
  slideIndex: number;
  prompt: string;
  placement: "right" | "left" | "background" | "background-dark" | "inline" | "cover-right" | "cover-left";
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
- placement は right, left, background, background-dark, inline, cover-right, cover-left のいずれか
- cover-right: スライドに .fullbleed-image が右側にある場合（全面画像テンプレート用）
- cover-left: スライドに .fullbleed-image が左側にある場合（全面画像テンプレート用）
- background-dark: スライドに .slide-bg-image がある場合（暗めオーバーレイ背景画像用）
- .fullbleed-image を含むスライドには必ず cover-right または cover-left を使う
- .slide-bg-image を含むスライドには必ず background-dark を使う

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
 *
 * 画像は必ず .slide コンテナの「中」に挿入する。
 * right/left は absolute で配置し、テキスト側に padding を追加して重ならないようにする。
 */
export function embedImageInSlideHtml(
  slide: HtmlSlide,
  imageUrl: string,
  placement: ImageNeed["placement"]
): HtmlSlide {
  // Cover / background-dark placements: replace .image-placeholder with actual image
  if (placement === "cover-right" || placement === "cover-left" || placement === "background-dark") {
    const coverImg = `<img src="${imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    const newHtml = slide.html.replace(
      /<div\s+class="image-placeholder"[^>]*>[^<]*<\/div>/,
      coverImg
    );
    return { ...slide, html: newHtml };
  }

  const imgStyle = (() => {
    switch (placement) {
      case "right":
        return 'position:absolute;right:24px;top:50%;transform:translateY(-50%);width:300px;height:auto;max-height:340px;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:2;';
      case "left":
        return 'position:absolute;left:24px;top:50%;transform:translateY(-50%);width:300px;height:auto;max-height:340px;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:2;';
      case "background":
        return 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.15;z-index:0;pointer-events:none;';
      case "inline":
      default:
        return 'display:block;max-width:280px;max-height:200px;object-fit:cover;border-radius:8px;margin:12px auto 0;box-shadow:0 4px 12px rgba(0,0,0,0.1);';
    }
  })();

  const imgTag = `<img src="${imageUrl}" alt="" style="${imgStyle}" />`;

  // テキストとの重なりを防ぐための padding 調整スタイル
  const paddingPatch = (() => {
    switch (placement) {
      case "right":
        return '<style>.slide>.content-area,.slide>.grid-2col,.slide>.bullet-list,.slide>.body-text,.slide>.kpi-grid,.slide>.message-area{padding-right:330px;}</style>';
      case "left":
        return '<style>.slide>.content-area,.slide>.grid-2col,.slide>.bullet-list,.slide>.body-text,.slide>.kpi-grid,.slide>.message-area{padding-left:330px;}</style>';
      default:
        return '';
    }
  })();

  // .slide の閉じタグ </div> を探して、その直前に挿入する
  const closingDivIndex = slide.html.lastIndexOf('</div>');
  if (closingDivIndex === -1) {
    // フォールバック: 見つからなければ末尾に追加
    return { ...slide, html: slide.html + imgTag };
  }

  const before = slide.html.substring(0, closingDivIndex);
  const after = slide.html.substring(closingDivIndex);

  if (placement === "background") {
    // background: .slide の開きタグ直後に挿入
    const openingMatch = slide.html.match(/<div\s+class="slide[^"]*"[^>]*>/);
    if (openingMatch) {
      const insertPos = (openingMatch.index ?? 0) + openingMatch[0].length;
      const htmlBefore = slide.html.substring(0, insertPos);
      const htmlAfter = slide.html.substring(insertPos);
      return { ...slide, html: htmlBefore + imgTag + htmlAfter };
    }
    return { ...slide, html: imgTag + slide.html };
  }

  // right/left/inline: 閉じ </div> の直前に画像 + padding調整を挿入
  return {
    ...slide,
    html: before + paddingPatch + imgTag + after,
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
