import { generateAiText, isAiConfigured } from "@/lib/ai";
import { mockViralCopy, parseModelCopy } from "./copy";
import { copyFailed, missingCopyKey } from "./messages";
import type { Bilingual, CreativeKind } from "./types";

const SYSTEM = `Eres el redactor viral de enone. Escribes pies de foto para redes (Instagram, Facebook, TikTok).
Responde SOLO con JSON válido, sin markdown, con esta forma:
{"caption":"...","hashtags":["#uno","#dos"]}
La caption lleva un gancho en la primera línea, un desarrollo corto, una llamada a la acción y emojis solo donde ayuden.
Máximo 500 caracteres en la caption. Entre 5 y 8 hashtags relevantes, en el idioma pedido, sin repetir la caption.
No expliques nada fuera del JSON.`;

export type CreativeCopy = {
  caption: string;
  hashtags: string[];
  warning: Bilingual | null;
};

export async function generateCreativeCopy(input: {
  prompt: string;
  kind: CreativeKind;
  style: string;
  lang: "es" | "en";
  mock: boolean;
}): Promise<CreativeCopy> {
  if (input.mock) {
    return { ...mockViralCopy(input.prompt, input.kind, input.lang), warning: null };
  }
  if (!isAiConfigured()) return { caption: "", hashtags: [], warning: missingCopyKey };
  const language = input.lang === "en" ? "English" : "español";
  try {
    const { content } = await generateAiText({
      system: SYSTEM,
      temperature: 0.85,
      user: `Idioma: ${language}.\nTipo: ${input.kind === "video" ? "video corto" : "imagen"}.\nEstilo visual: ${input.style || "sin estilo extra"}.\nIdea del usuario: ${input.prompt}`,
    });
    const parsed = parseModelCopy(content);
    if (!parsed) throw new Error("parse");
    return { ...parsed, warning: null };
  } catch {
    return { caption: "", hashtags: [], warning: copyFailed };
  }
}
