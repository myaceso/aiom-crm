/** Channel metadata Buffer's createPost requires. Instagram type is mandatory. */

export type InstagramPlacement = "post" | "story" | "reel";

export function asInstagramPlacement(value: unknown): InstagramPlacement | undefined {
  return value === "post" || value === "story" || value === "reel" ? value : undefined;
}

/** A single video cannot be a feed post; Buffer expects a reel. Stories stay stories. */
export function resolveInstagramType(requested: InstagramPlacement | undefined, hasVideo: boolean): InstagramPlacement {
  if (requested === "story") return "story";
  if (requested === "reel" || hasVideo) return "reel";
  return "post";
}

export function defaultInstagramType(hasVideo: boolean): InstagramPlacement {
  return hasVideo ? "reel" : "post";
}

function firstLine(text: string, max: number, fallback: string): string {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean);
  return (line || fallback).slice(0, max);
}

/** TikTok photo/text posts allow 4000; a video drops the caption limit to 2200. Counts are UTF-16 code units. */
export function tiktokTextLimit(hasVideo: boolean): number {
  return hasVideo ? 2200 : 4000;
}

export function fitTikTokText(text: string, hasVideo: boolean): { text: string; warning?: string } {
  const limit = tiktokTextLimit(hasVideo);
  if (text.length <= limit) return { text };
  return {
    text: text.slice(0, limit).trimEnd(),
    warning: hasVideo
      ? "El texto se recortó a 2200 caracteres, el límite de TikTok para videos."
      : "El texto se recortó a 4000 caracteres, el límite de TikTok para fotos.",
  };
}

export function buildServiceMetadata(
  service: string,
  opts: { instagramType?: InstagramPlacement; hasVideo: boolean; hasImage?: boolean; text: string; tiktokTitle?: string }
): { metadata?: Record<string, unknown>; text?: string; warning?: string; error?: string } {
  const key = service.toLowerCase().replace(/[\s_-]/g, "");
  if (key === "instagram") {
    const type = resolveInstagramType(opts.instagramType, opts.hasVideo);
    return {
      metadata: { instagram: { type, shouldShareToFeed: type !== "story" } },
      warning: opts.instagramType === "post" && opts.hasVideo ? "Instagram publica un video suelto como Reel." : undefined,
    };
  }
  if (key === "facebook") return { metadata: { facebook: { type: "post" } } };
  if (key === "googlebusiness" || key === "google" || key === "gbp") {
    return { metadata: { google: { type: "post" } } };
  }
  if (key === "youtube") {
    return { metadata: { youtube: { title: firstLine(opts.text, 100, "Video"), categoryId: "22" } } };
  }
  if (key === "tiktok") {
    if (!opts.hasVideo && !opts.hasImage) {
      return { error: "TikTok necesita una imagen o un video. Un texto solo no se puede publicar ahí." };
    }
    const fitted = fitTikTokText(opts.text, opts.hasVideo);
    if (opts.hasVideo) {
      return { text: fitted.text, warning: fitted.warning };
    }
    const title = (opts.tiktokTitle || firstLine(fitted.text, 90, "Foto")).trim().slice(0, 90) || "Foto";
    return {
      text: fitted.text,
      warning: fitted.warning,
      metadata: { tiktok: { title } },
    };
  }
  if (key === "pinterest") {
    return {
      error: "Pinterest necesita un tablero. Elige el tablero en Buffer y vuelve a publicar ese canal.",
    };
  }
  return {};
}
