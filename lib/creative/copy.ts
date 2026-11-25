import type { CreativeKind } from "./types";

export function parseHashtags(raw: string): string[] {
  const parts = raw.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  const tags: string[] = [];
  for (const part of parts) {
    const withHash = part.startsWith("#") ? part : `#${part}`;
    const clean = withHash.replace(/[^#0-9A-Za-z_\u00C0-\u024F]/g, "");
    if (clean.length < 2 || tags.includes(clean)) continue;
    tags.push(clean.slice(0, 40));
    if (tags.length >= 12) break;
  }
  return tags;
}

export function postText(caption?: string, hashtags?: string[]): string {
  const cap = (caption || "").trim();
  const tags = (hashtags || []).filter(Boolean).join(" ");
  return [cap, tags].filter(Boolean).join("\n\n").slice(0, 2200);
}

/** Read caption + hashtags from a stored asset, including older field names. */
export function normalizeStoredCopy(raw: {
  caption?: unknown;
  viralCaption?: unknown;
  copy?: unknown;
  text?: unknown;
  hashtags?: unknown;
  hashTags?: unknown;
  tags?: unknown;
} | null | undefined): { caption: string; hashtags: string[] } {
  const source = raw || {};
  const caption = [source.caption, source.viralCaption, source.copy, source.text]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean) || "";
  const tagSource = source.hashtags ?? source.hashTags ?? source.tags;
  const joined = Array.isArray(tagSource) ? tagSource.map((tag) => String(tag)).join(" ") : String(tagSource || "");
  return { caption: caption.slice(0, 1800), hashtags: parseHashtags(joined) };
}

export function parseModelCopy(raw: string): { caption: string; hashtags: string[] } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(trimmed.slice(start, end + 1)) as { caption?: unknown; hashtags?: unknown };
    const caption = String(data.caption || "").trim().slice(0, 1800);
    const source = Array.isArray(data.hashtags) ? data.hashtags.map((tag) => String(tag)).join(" ") : String(data.hashtags || "");
    const hashtags = parseHashtags(source);
    if (!caption) return null;
    return { caption, hashtags };
  } catch {
    return null;
  }
}

function topicTag(prompt: string): string {
  const word = prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((part) => part.length > 3);
  return word ? `#${word.slice(0, 24)}` : "#idea";
}

/** Local caption so CREATIVE_MOCK can exercise the studio without a text API key. */
export function mockViralCopy(prompt: string, kind: CreativeKind, lang: "es" | "en" = "es"): { caption: string; hashtags: string[] } {
  const topic = prompt.trim().replace(/\s+/g, " ").slice(0, 140) || (lang === "es" ? "esta idea" : "this idea");
  if (lang === "en") {
    return {
      caption: `Wait for it.\n\n${topic}\n\nSave this and send it to someone who needs it today. Drop a YES if you want the next one.`,
      hashtags: ["#viral", "#fyp", "#marketing", topicTag(prompt), "#content", "#trending"],
    };
  }
  const caption = kind === "video"
    ? `Espera al final.\n\n${topic}\n\nEsto se está compartiendo por todos lados. Guarda el video y mándaselo a quien lo necesita.\n\nComenta YO y te paso la idea.`
    : `Nadie te dice esto.\n\n${topic}\n\nGuárdalo antes de que se pierda y etiqueta a quien tiene que verlo.\n\n¿Lo pruebas hoy?`;
  return {
    caption,
    hashtags: ["#viral", "#parati", "#marketing", topicTag(prompt), "#contenido", "#tendencia"],
  };
}
