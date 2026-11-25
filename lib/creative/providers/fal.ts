import { isFalMediaUrl, isPublicHttps, isQueueUrl } from "../remote";
import type { VideoGenInput, VideoPoll, VideoSubmit } from "./types";
import { ProviderError } from "./types";

const TEXT_MODEL = () => process.env.FAL_TEXT_TO_VIDEO_MODEL?.trim() || "kling/v4/text-to-video";
const IMAGE_MODEL = () => process.env.FAL_IMAGE_TO_VIDEO_MODEL?.trim() || "kling/v4/image-to-video";

function resolution(): string {
  const value = process.env.FAL_VIDEO_RESOLUTION?.trim() || "720p";
  return value === "1080p" || value === "4k" ? value : "720p";
}

function clip(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function falJson(url: string, apiKey: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

export async function uploadFalImage(bytes: Buffer, apiKey: string): Promise<string> {
  const init = await falJson("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", apiKey, {
    method: "POST",
    body: JSON.stringify({ content_type: "image/jpeg", file_name: "reference.jpg" }),
  });
  if (init.status === 401 || init.status === 403) throw new ProviderError(clip(init.data.detail) || "fal auth", "auth");
  if (!init.ok) throw new ProviderError(clip(init.data.detail) || "No se pudo subir la imagen de referencia.", "provider");
  const uploadUrl = typeof init.data.upload_url === "string" ? init.data.upload_url : "";
  const fileUrl = typeof init.data.file_url === "string" ? init.data.file_url : "";
  if (!isPublicHttps(uploadUrl) || !isFalMediaUrl(fileUrl)) {
    throw new ProviderError("fal.ai no devolvió una URL de subida válida.", "provider");
  }
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) throw new ProviderError("No se pudo subir la imagen de referencia a fal.ai.", "provider");
  return fileUrl;
}

export async function submitFalVideo(input: VideoGenInput, apiKey: string): Promise<VideoSubmit> {
  const model = input.referenceUrl ? IMAGE_MODEL() : TEXT_MODEL();
  if (!/^[a-z0-9][a-z0-9._/-]{2,120}$/i.test(model)) {
    throw new ProviderError("El modelo de video configurado no es válido.", "invalid");
  }
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    duration: input.durationSec,
    resolution: resolution(),
  };
  if (input.referenceUrl) body.start_image_url = input.referenceUrl;
  else body.aspect_ratio = input.aspectRatio;

  const result = await falJson(`https://queue.fal.run/${model}`, apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (result.status === 401 || result.status === 403) {
    throw new ProviderError(clip(result.data.detail) || "fal auth", "auth");
  }
  if (!result.ok) throw new ProviderError(clip(result.data.detail) || `fal.ai ${result.status}`, "provider");
  const requestId = result.data.request_id;
  const statusUrl = result.data.status_url;
  const responseUrl = result.data.response_url;
  if (typeof requestId !== "string" || typeof statusUrl !== "string" || typeof responseUrl !== "string") {
    throw new ProviderError("fal.ai no devolvió un trabajo válido.", "provider");
  }
  if (!isQueueUrl(statusUrl) || !isQueueUrl(responseUrl)) {
    throw new ProviderError("fal.ai devolvió una URL de estado no permitida.", "provider");
  }
  return { providerJobId: requestId, statusUrl, responseUrl };
}

export async function pollFalVideo(statusUrl: string, responseUrl: string, apiKey: string): Promise<VideoPoll> {
  if (!isQueueUrl(statusUrl) || !isQueueUrl(responseUrl)) {
    return { state: "failed", error: "URL de estado no válida." };
  }
  const status = await falJson(statusUrl, apiKey);
  if (status.status === 401 || status.status === 403) throw new ProviderError("fal auth", "auth");
  if (!status.ok) throw new ProviderError(clip(status.data.detail) || `fal.ai ${status.status}`, "provider");
  const state = String(status.data.status || "");
  if (state === "IN_QUEUE") {
    const position = typeof status.data.queue_position === "number" ? status.data.queue_position : undefined;
    return { state: "pending", phase: "queued", queuePosition: position };
  }
  if (state === "IN_PROGRESS") return { state: "pending", phase: "running" };
  if (status.data.error || state === "FAILED") {
    return { state: "failed", error: clip(status.data.error) || "La generación de video falló." };
  }
  if (state !== "COMPLETED") return { state: "pending", phase: "running" };

  const result = await falJson(responseUrl, apiKey);
  if (!result.ok) throw new ProviderError(clip(result.data.detail) || "No se pudo leer el video.", "provider");
  const video = result.data.video as { url?: string; content_type?: string } | undefined;
  const url = video?.url || "";
  if (!url) return { state: "failed", error: clip(result.data.detail) || "fal.ai no devolvió el video." };
  return { state: "succeeded", url, mime: video?.content_type || "video/mp4" };
}

export async function testFalKey(apiKey: string): Promise<void> {
  const result = await falJson("https://rest.fal.ai/billing/user_balance", apiKey);
  if (result.status === 401 || result.status === 403) throw new ProviderError("fal auth", "auth");
  if (!result.ok) throw new ProviderError(clip(result.data.detail) || `fal.ai ${result.status}`, "provider");
}
