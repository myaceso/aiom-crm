export const IMAGE_ASPECTS = ["1:1", "4:5", "16:9", "9:16"] as const;
export const VIDEO_ASPECTS = ["16:9", "9:16", "1:1", "3:4"] as const;
export const VIDEO_DURATIONS = [5, 10] as const;
export const STYLE_IDS = ["photo", "illustration", "minimal", "cinematic", "watercolor", "render3d"] as const;

export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];
export type StyleId = (typeof STYLE_IDS)[number] | "";
export type CreativeKind = "image" | "video";
export type CreativeProviderId = "openai" | "fal" | "mock";

export type CreativeAsset = {
  id: string;
  kind: CreativeKind;
  prompt: string;
  style: string;
  aspectRatio: string;
  durationSec?: number;
  url: string;
  mime: string;
  name: string;
  size: number;
  provider: CreativeProviderId;
  createdAt: string;
};

export type StoredCreativeAsset = CreativeAsset & {
  userId: string;
  pathname: string;
};

export type CreativeJob = {
  id: string;
  userId: string;
  kind: CreativeKind;
  prompt: string;
  style: string;
  aspectRatio: string;
  durationSec?: number;
  hasReference: boolean;
  status: "pending" | "succeeded" | "failed";
  provider: CreativeProviderId;
  providerJobId?: string;
  statusUrl?: string;
  responseUrl?: string;
  readyAt?: number;
  assetId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type Bilingual = { es: string; en: string };

export type CreativeConfig = {
  image: boolean;
  video: boolean;
  mock: boolean;
  messages: {
    image: Bilingual | null;
    video: Bilingual | null;
    mock: Bilingual | null;
  };
};
