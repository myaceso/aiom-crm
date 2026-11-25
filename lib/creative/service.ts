import { acquireLock, releaseLock } from "@/lib/kvStore";
import { invalidKeyImage, invalidKeyVideo } from "./messages";
import { downloadRemote, isPublicHttps } from "./remote";
import { generateImage, pollVideo, ProviderError, submitVideo, uploadReferenceImage } from "./providers";
import { buildCreativePrompt, normalizeStyle } from "./prompt";
import {
  clearPending,
  countPending,
  getAsset,
  getJob,
  listAssets,
  removeAssetRecord,
  saveAsset,
  saveJob,
  sweepPending,
  trackPending,
  trimAssets,
} from "./records";
import { removeStored, storeMedia } from "./storage";
import type { CreativeKeys as Keys } from "./keys";
import type { Bilingual, CreativeAsset, CreativeConfig, CreativeJob, StoredCreativeAsset } from "./types";
import { IMAGE_ASPECTS, VIDEO_ASPECTS, type CreativeKind, type StyleId } from "./types";

type Parsed = {
  kind: CreativeKind;
  prompt: string;
  style: StyleId;
  aspectRatio: string;
  durationSec: 5 | 10;
  photo?: Buffer;
};

const text = (es: string, en: string): Bilingual => ({ es, en });

export class CreativeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly copy: Bilingual
  ) {
    super(copy.es);
    this.name = "CreativeRequestError";
  }
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

export function parseGenerateBody(body: unknown): Parsed {
  const record = asRecord(body);
  if (!record) throw new CreativeRequestError(400, "invalid_input", text("La solicitud no es válida.", "The request is not valid."));
  const kind = record.kind === "video" ? "video" : record.kind === "image" ? "image" : "";
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!kind || !prompt || prompt.length > 2000) {
    throw new CreativeRequestError(400, "invalid_input", text("Escribe un prompt de hasta 2000 caracteres.", "Write a prompt of up to 2000 characters."));
  }
  const aspects = kind === "image" ? IMAGE_ASPECTS : VIDEO_ASPECTS;
  const requested = typeof record.aspectRatio === "string" ? record.aspectRatio : aspects[0];
  const aspectRatio = (aspects as readonly string[]).includes(requested) ? requested : aspects[0];
  const duration = record.duration === 10 || record.duration === "10" ? 10 : 5;
  let photo: Buffer | undefined;
  if (typeof record.photo === "string" && record.photo) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(record.photo);
    if (!match || record.photo.length > 2_000_000) {
      throw new CreativeRequestError(400, "invalid_photo", text("La imagen de referencia debe ser un JPEG pequeño.", "The reference image must be a small JPEG."));
    }
    photo = Buffer.from(match[1], "base64");
    if (photo.length < 64 || photo.length > 1_600_000) {
      throw new CreativeRequestError(400, "invalid_photo", text("La imagen de referencia no es válida.", "The reference image is not valid."));
    }
  }
  return { kind, prompt, style: normalizeStyle(record.style), aspectRatio, durationSec: duration, photo };
}

function toPublic(asset: StoredCreativeAsset): CreativeAsset {
  return {
    id: asset.id,
    kind: asset.kind,
    prompt: asset.prompt,
    style: asset.style,
    aspectRatio: asset.aspectRatio,
    durationSec: asset.durationSec,
    url: asset.url,
    mime: asset.mime,
    name: asset.name,
    size: asset.size,
    provider: asset.provider,
    createdAt: asset.createdAt,
  };
}

function providerCopy(error: ProviderError, kind: CreativeKind): CreativeRequestError {
  if (error.code === "auth") {
    const copy = kind === "image" ? invalidKeyImage : invalidKeyVideo;
    return new CreativeRequestError(422, "invalid_key", copy);
  }
  const detail = /sk-|bearer|api[_-]?key|secret/i.test(error.message) ? "Error del proveedor." : error.message.slice(0, 240);
  return new CreativeRequestError(502, "provider_error", text(`No se pudo generar. ${detail}`, `Could not generate. ${detail}`));
}

function stampName(kind: CreativeKind, mime: string): string {
  const ext = mime === "video/mp4" ? "mp4" : mime === "image/png" ? "png" : "jpg";
  const label = kind === "video" ? "video" : "imagen";
  return `enone-${label}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.${ext}`;
}

async function materialize(
  userId: string,
  job: {
    kind: CreativeKind;
    prompt: string;
    style: string;
    aspectRatio: string;
    durationSec?: number;
    provider: CreativeAsset["provider"];
  },
  bytes: Buffer,
  mime: string
): Promise<CreativeAsset> {
  const id = crypto.randomUUID();
  const stored = await storeMedia(userId, id, bytes, mime);
  const asset: StoredCreativeAsset = {
    id,
    userId,
    kind: job.kind,
    prompt: job.prompt,
    style: job.style,
    aspectRatio: job.aspectRatio,
    durationSec: job.kind === "video" ? job.durationSec : undefined,
    url: stored.url,
    pathname: stored.pathname,
    mime,
    name: stampName(job.kind, mime),
    size: bytes.length,
    provider: job.provider,
    createdAt: new Date().toISOString(),
  };
  await saveAsset(asset);
  const extra = await trimAssets(userId);
  for (const old of extra) {
    await removeStored(old.pathname, old.url, old.userId, old.id, old.mime);
    await removeAssetRecord(old.userId, old.id);
  }
  return toPublic(asset);
}

async function bytesFromResult(result: { bytes?: Buffer; url?: string; mime: string }, kind: CreativeKind): Promise<{ bytes: Buffer; mime: string }> {
  if (result.bytes && result.bytes.length > 32) {
    return { bytes: result.bytes, mime: result.mime };
  }
  if (!result.url) throw new ProviderError("El proveedor no devolvió el archivo.", "provider");
  const remote = await downloadRemote(result.url, kind === "video" ? 80_000_000 : 20_000_000);
  const mime = remote.mime.startsWith("image/") || remote.mime.startsWith("video/") ? remote.mime : result.mime;
  if (kind === "video" && mime !== "video/mp4" && mime !== "video/webm") {
    throw new ProviderError("El video recibido no es MP4.", "provider");
  }
  if (kind === "image" && !["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new ProviderError("La imagen recibida no tiene un formato admitido.", "provider");
  }
  return { bytes: remote.bytes, mime: kind === "video" && mime === "video/webm" ? mime : kind === "video" ? "video/mp4" : mime };
}

export async function galleryFor(userId: string): Promise<CreativeAsset[]> {
  await sweepPending(userId);
  const assets = await listAssets(userId);
  return assets.map(toPublic);
}

export async function deleteGalleryItem(userId: string, id: string): Promise<boolean> {
  const asset = await getAsset(userId, id);
  if (!asset) return false;
  await removeStored(asset.pathname, asset.url, asset.userId, asset.id, asset.mime);
  await removeAssetRecord(userId, id);
  return true;
}

async function hostReference(userId: string, photo: Buffer, keys: Keys): Promise<string> {
  if (keys.mock) return "mock://reference";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const stored = await storeMedia(userId, crypto.randomUUID(), photo, "image/jpeg", "creative-ref");
    if (!isPublicHttps(stored.url)) throw new ProviderError("La imagen de referencia no quedó en una URL pública.", "provider");
    return stored.url;
  }
  return uploadReferenceImage(photo, keys.fal);
}

export async function startGeneration(
  userId: string,
  input: Parsed,
  keys: Keys
): Promise<{ status: "succeeded"; asset: CreativeAsset } | { status: "pending"; job: string }> {
  if (input.kind === "image" && !keys.imageReady) {
    throw new CreativeRequestError(503, "missing_key", keys.config.messages.image || text("Falta la clave de OpenAI.", "The OpenAI key is missing."));
  }
  if (input.kind === "video" && !keys.videoReady) {
    throw new CreativeRequestError(503, "missing_key", keys.config.messages.video || text("Falta la clave de fal.ai.", "The fal.ai key is missing."));
  }

  const styled = buildCreativePrompt(input.prompt, input.style, input.kind);
  if (input.kind === "image") {
    const lock = `enone:creative:image:${userId}`;
    if (!(await acquireLock(lock, 55))) {
      throw new CreativeRequestError(429, "busy", text("Ya se está generando una imagen. Espera un momento.", "An image is already generating. Wait a moment."));
    }
    try {
      const provider = keys.mock ? "mock" : "openai";
      const image = await generateImage(provider, { prompt: provider === "mock" ? input.prompt : styled, aspectRatio: input.aspectRatio }, keys.openai);
      const file = await bytesFromResult({ bytes: image.bytes, url: image.remoteUrl, mime: image.mime }, "image");
      const asset = await materialize(userId, { ...input, provider }, file.bytes, file.mime);
      return { status: "succeeded", asset };
    } catch (error) {
      if (error instanceof ProviderError) throw providerCopy(error, "image");
      throw error;
    } finally {
      await releaseLock(lock);
    }
  }

  if ((await countPending(userId)) >= 3) {
    throw new CreativeRequestError(429, "busy", text("Ya tienes 3 videos en proceso. Espera a que terminen.", "You already have 3 videos in progress. Wait for them to finish."));
  }
  try {
    const referenceUrl = input.photo ? await hostReference(userId, input.photo, keys) : undefined;
    const provider = keys.mock ? "mock" : "fal";
    const remote = await submitVideo(
      provider,
      {
        prompt: styled,
        aspectRatio: input.aspectRatio,
        durationSec: input.durationSec,
        referenceUrl: provider === "mock" ? undefined : referenceUrl,
      },
      keys.fal
    );
    const now = new Date().toISOString();
    const job: CreativeJob = {
      id: crypto.randomUUID(),
      userId,
      kind: "video",
      prompt: input.prompt,
      style: input.style,
      aspectRatio: input.aspectRatio,
      durationSec: input.durationSec,
      hasReference: !!input.photo,
      status: "pending",
      provider,
      providerJobId: remote.providerJobId,
      statusUrl: remote.statusUrl,
      responseUrl: remote.responseUrl,
      readyAt: remote.readyAt,
      createdAt: now,
      updatedAt: now,
    };
    await saveJob(job);
    await trackPending(userId, job.id);
    return { status: "pending", job: job.id };
  } catch (error) {
    if (error instanceof ProviderError) throw providerCopy(error, "video");
    throw error;
  }
}

export type JobView =
  | { status: "pending"; phase: "queued" | "running" | "saving"; queuePosition?: number }
  | { status: "succeeded"; asset: CreativeAsset }
  | { status: "failed"; copy: Bilingual };

export async function readGeneration(userId: string, jobId: string, keys: Keys): Promise<JobView> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    throw new CreativeRequestError(400, "invalid_job", text("El trabajo no es válido.", "The job is not valid."));
  }
  const job = await getJob(userId, jobId);
  if (!job) throw new CreativeRequestError(404, "not_found", text("No encontramos esa generación.", "We could not find that generation."));
  if (job.status === "succeeded" && job.assetId) {
    const asset = await getAsset(userId, job.assetId);
    if (asset) return { status: "succeeded", asset: toPublic(asset) };
  }
  if (job.status === "failed") {
    return {
      status: "failed",
      copy: text(job.error === "expired" ? "El video tardó demasiado y se canceló." : "No se pudo generar el video.", job.error === "expired" ? "The video took too long and was cancelled." : "The video could not be generated."),
    };
  }
  if (job.provider !== "fal" && job.provider !== "mock") {
    throw new CreativeRequestError(422, "generation_failed", text("Ese trabajo no se puede consultar.", "That job cannot be checked."));
  }

  let poll;
  try {
    poll = await pollVideo(job.provider, { statusUrl: job.statusUrl || "", responseUrl: job.responseUrl || "", readyAt: job.readyAt }, job.provider === "fal" ? keys.fal : "");
  } catch (error) {
    if (error instanceof ProviderError) throw providerCopy(error, "video");
    throw error;
  }
  if (poll.state === "pending") return { status: "pending", phase: poll.phase, queuePosition: poll.queuePosition };
  if (poll.state === "failed") {
    await saveJob({ ...job, status: "failed", error: poll.error, updatedAt: new Date().toISOString() });
    await clearPending(userId, job.id);
    return { status: "failed", copy: text(`No se pudo generar el video. ${poll.error}`, `The video could not be generated. ${poll.error}`) };
  }

  const lock = `enone:creative:finalize:${job.id}`;
  if (!(await acquireLock(lock, 55))) return { status: "pending", phase: "saving" };
  try {
    const fresh = await getJob(userId, jobId);
    if (fresh?.status === "succeeded" && fresh.assetId) {
      const asset = await getAsset(userId, fresh.assetId);
      if (asset) return { status: "succeeded", asset: toPublic(asset) };
    }
    const file = await bytesFromResult(poll, "video");
    const asset = await materialize(userId, { ...job, provider: job.provider }, file.bytes, file.mime);
    await saveJob({ ...job, status: "succeeded", assetId: asset.id, updatedAt: new Date().toISOString() });
    await clearPending(userId, job.id);
    return { status: "succeeded", asset };
  } catch (error) {
    if (error instanceof ProviderError) throw providerCopy(error, "video");
    throw error;
  } finally {
    await releaseLock(lock);
  }
}

export function configOf(keys: Keys): CreativeConfig {
  return keys.config;
}
