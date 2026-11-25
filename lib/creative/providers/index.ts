/**
 * Provider seam for the marketing studio.
 * Images go through OpenAI's Images API. Videos go through fal.ai's queue
 * (Kling 4 by default): the route only submits a job and later polls it.
 * Set CREATIVE_MOCK=1 to use the local demo provider instead.
 * To swap a vendor, replace the body of the matching function below.
 */
import { generateMockImage, pollMockVideo, submitMockVideo } from "./mock";
import { generateOpenAiImage } from "./openai";
import { pollFalVideo, submitFalVideo, uploadFalImage } from "./fal";
import type { ImageGenInput, VideoGenInput, VideoPoll, VideoSubmit } from "./types";

export async function generateImage(
  provider: "openai" | "mock",
  input: ImageGenInput,
  apiKey: string
): Promise<{ bytes: Buffer; mime: string; remoteUrl?: string }> {
  if (provider === "mock") {
    const image = await generateMockImage(input);
    return { ...image };
  }
  return generateOpenAiImage(input, apiKey);
}

export async function submitVideo(
  provider: "fal" | "mock",
  input: VideoGenInput,
  apiKey: string
): Promise<VideoSubmit> {
  if (provider === "mock") return submitMockVideo(input);
  return submitFalVideo(input, apiKey);
}

export async function pollVideo(
  provider: "fal" | "mock",
  remote: { statusUrl: string; responseUrl: string; readyAt?: number },
  apiKey: string
): Promise<VideoPoll> {
  if (provider === "mock") return pollMockVideo(remote.readyAt);
  return pollFalVideo(remote.statusUrl, remote.responseUrl, apiKey);
}

export async function uploadReferenceImage(bytes: Buffer, apiKey: string): Promise<string> {
  return uploadFalImage(bytes, apiKey);
}

export { ProviderError } from "./types";
export { testFalKey } from "./fal";
