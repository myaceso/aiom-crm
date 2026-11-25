import { readFile } from "fs/promises";
import path from "path";
import { renderMockImage } from "../mockImage";
import type { ImageGenInput, VideoGenInput, VideoPoll, VideoSubmit } from "./types";

let demoVideo: Buffer | null = null;

async function loadDemoVideo(): Promise<Buffer> {
  if (demoVideo) return demoVideo;
  demoVideo = await readFile(path.join(process.cwd(), "lib/creative/fixtures/demo.mp4"));
  return demoVideo;
}

export async function generateMockImage(input: ImageGenInput): Promise<{ bytes: Buffer; mime: string }> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { bytes: renderMockImage(input.prompt, input.aspectRatio), mime: "image/png" };
}

export async function submitMockVideo(input: VideoGenInput): Promise<VideoSubmit> {
  return {
    providerJobId: `mock-${input.durationSec}`,
    statusUrl: "mock://status",
    responseUrl: "mock://result",
    readyAt: Date.now() + 3500,
  };
}

export async function pollMockVideo(readyAt: number | undefined): Promise<VideoPoll> {
  if (!readyAt || Date.now() < readyAt) return { state: "pending", phase: "running" };
  const bytes = await loadDemoVideo();
  return { state: "succeeded", bytes, mime: "video/mp4" };
}
