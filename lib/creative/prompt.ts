import { STYLE_IDS, type StyleId } from "./types";

const STYLE_PROMPTS: Record<Exclude<StyleId, "">, string> = {
  photo: "photorealistic commercial photography, natural light, sharp detail",
  illustration: "clean digital illustration, bold shapes, polished advertising art",
  minimal: "minimalist composition, generous negative space, simple forms",
  cinematic: "cinematic lighting, film still, shallow depth of field",
  watercolor: "watercolor painting on paper, soft pigments",
  render3d: "high-end 3D render, soft studio lighting, product-ad quality",
};

export function normalizeStyle(value: unknown): StyleId {
  if (typeof value !== "string") return "";
  const id = value.trim();
  return (STYLE_IDS as readonly string[]).includes(id) ? (id as StyleId) : "";
}

export function buildCreativePrompt(prompt: string, style: StyleId, kind: "image" | "video"): string {
  const styleLine = style ? STYLE_PROMPTS[style] : "";
  const guard =
    kind === "image"
      ? "No watermarks, logos, or extra lettering unless the prompt asks for them."
      : "No watermarks or logos unless the prompt asks for them.";
  return [prompt.trim(), styleLine ? `Visual style: ${styleLine}.` : "", guard].filter(Boolean).join("\n\n");
}

const OPENAI_SIZES = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5": "1024x1536",
} as const;

export function openAiSize(aspect: string): string {
  return OPENAI_SIZES[aspect as keyof typeof OPENAI_SIZES] || "1024x1024";
}
