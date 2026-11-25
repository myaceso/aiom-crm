"use client";

import type { MediaAsset } from "./types";
import { saveMediaBlob } from "./mediaDb";
import { toInstagramFriendlyImage, uploadToCloud } from "./mediaCloud";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 200 * 1024 * 1024;

function uid() {
  return `m${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function readVideoMeta(file: File): Promise<{ durationSec?: number; posterUrl?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(url);
    const done = (meta: { durationSec?: number; posterUrl?: string }) => {
      cleanup();
      resolve(meta);
    };
    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : undefined;
      try {
        video.currentTime = Math.min(0.1, durationSec || 0);
      } catch {
        done({ durationSec });
        return;
      }
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            done({ durationSec });
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                done({ durationSec });
                return;
              }
              done({ durationSec, posterUrl: URL.createObjectURL(blob) });
            },
            "image/jpeg",
            0.7
          );
        } catch {
          done({ durationSec });
        }
      };
    };
    video.onerror = () => done({});
    video.src = url;
  });
}

export type IngestResult =
  | { ok: true; asset: MediaAsset; cloudError?: string }
  | { ok: false; reason: "type" | "size" | "save" };

/** Save a local file into the composer library and upload it when Blob is configured. */
export async function ingestMediaFile(original: File, userId: string): Promise<IngestResult> {
  let file = original;
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return { ok: false, reason: "type" };
  if (file.size > (isImage ? IMAGE_MAX : VIDEO_MAX)) return { ok: false, reason: "size" };
  if (isImage) file = await toInstagramFriendlyImage(file);
  const id = uid();
  try {
    await saveMediaBlob(id, file);
  } catch {
    return { ok: false, reason: "save" };
  }
  let previewUrl = URL.createObjectURL(file);
  let durationSec: number | undefined;
  if (isVideo) {
    const meta = await readVideoMeta(file);
    durationSec = meta.durationSec;
    if (meta.posterUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = meta.posterUrl;
    }
  }
  const asset: MediaAsset = {
    id,
    kind: isImage ? "image" : "video",
    name: file.name,
    size: file.size,
    mime: file.type || (isImage ? "image/jpeg" : "video/mp4"),
    createdAt: new Date().toISOString(),
    previewUrl,
    durationSec,
  };
  let cloudError: string | undefined;
  if (userId) {
    try {
      const cloud = await uploadToCloud(userId, id, file, file.name, asset.mime);
      asset.url = cloud.url;
      asset.pathname = cloud.pathname;
    } catch (error) {
      cloudError = error instanceof Error ? error.message : "";
    }
  }
  return { ok: true, asset, cloudError };
}
