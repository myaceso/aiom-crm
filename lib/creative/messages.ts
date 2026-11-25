import type { Bilingual } from "./types";

export const missingImageKey: Bilingual = {
  es: "Para generar imágenes agrega la clave de OpenAI en Integraciones (Clave de OpenAI) o la variable OPENAI_API_KEY en Vercel. Crea la clave en platform.openai.com.",
  en: "To generate images, add an OpenAI key in Integrations (OpenAI key) or the OPENAI_API_KEY variable on Vercel. Create the key at platform.openai.com.",
};

export const missingVideoKey: Bilingual = {
  es: "Para generar videos agrega la clave de fal.ai en Integraciones (Clave de fal.ai) o la variable FAL_KEY en Vercel. Crea la cuenta y la clave en fal.ai (Dashboard → Keys).",
  en: "To generate videos, add a fal.ai key in Integrations (fal.ai key) or the FAL_KEY variable on Vercel. Create the account and key at fal.ai (Dashboard → Keys).",
};

export const mockModeNote: Bilingual = {
  es: "Modo de prueba activo (CREATIVE_MOCK). Las imágenes y los videos son de demostración y no llaman a OpenAI ni a fal.ai.",
  en: "Test mode is on (CREATIVE_MOCK). Images and videos are demos and do not call OpenAI or fal.ai.",
};

export const invalidKeyImage: Bilingual = {
  es: "La clave de OpenAI fue rechazada. Revísala en Integraciones o en la variable OPENAI_API_KEY.",
  en: "The OpenAI key was rejected. Check it in Integrations or in the OPENAI_API_KEY variable.",
};

export const invalidKeyVideo: Bilingual = {
  es: "La clave de fal.ai fue rechazada. Revísala en Integraciones o en la variable FAL_KEY.",
  en: "The fal.ai key was rejected. Check it in Integrations or in the FAL_KEY variable.",
};
