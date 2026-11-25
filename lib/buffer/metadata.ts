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

function youtubeTitle(text: string): string {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean);
  return (line || "Video").slice(0, 100);
}

export function buildServiceMetadata(
  service: string,
  opts: { instagramType?: InstagramPlacement; hasVideo: boolean; text: string }
): { metadata?: Record<string, unknown>; warning?: string; error?: string } {
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
    return { metadata: { youtube: { title: youtubeTitle(opts.text), categoryId: "22" } } };
  }
  if (key === "pinterest") {
    return {
      error: "Pinterest necesita un tablero. Elige el tablero en Buffer y vuelve a publicar ese canal.",
    };
  }
  return {};
}
