import { getCrmState } from "@/lib/crmDb";
import { missingImageKey, missingVideoKey, mockModeNote } from "./messages";
import type { CreativeConfig } from "./types";

function clean(value: string | undefined): string {
  return (value || "").trim().slice(0, 400);
}

export type CreativeKeys = {
  mock: boolean;
  openai: string;
  fal: string;
  imageReady: boolean;
  videoReady: boolean;
  config: CreativeConfig;
};

export async function resolveCreativeKeys(userId: string): Promise<CreativeKeys> {
  const mock = process.env.CREATIVE_MOCK === "1";
  const crm = await getCrmState(userId).catch(() => null);
  const creative = crm?.integrations?.creative;
  const saved = creative?.connected ? creative : undefined;
  const openai = clean(process.env.OPENAI_API_KEY) || clean(saved?.openaiApiKey);
  const fal = clean(process.env.FAL_KEY) || clean(saved?.falKey);
  const imageReady = mock || !!openai;
  const videoReady = mock || !!fal;
  return {
    mock,
    openai,
    fal,
    imageReady,
    videoReady,
    config: {
      image: imageReady,
      video: videoReady,
      mock,
      messages: {
        image: imageReady ? null : missingImageKey,
        video: videoReady ? null : missingVideoKey,
        mock: mock ? mockModeNote : null,
      },
    },
  };
}
