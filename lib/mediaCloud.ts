"use client";

import { upload } from "@vercel/blob/client";
import { getMediaBlob } from "./mediaDb";
import type { MediaAsset } from "./types";

/** Instagram only accepts JPEG images: convert PNG/WEBP/GIF/HEIC (or very large JPEGs) client-side. */
export async function toInstagramFriendlyImage(file: File): Promise<File> {
  const isJpeg = file.type === "image/jpeg";
  if (isJpeg && file.size <= 8 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2048;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return file;
    const name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function safeName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-80) || "media"
  );
}

/** Upload a file to Vercel Blob (public URL reachable by Facebook/Instagram). */
export async function uploadToCloud(
  userId: string,
  assetId: string,
  file: Blob,
  name: string,
  contentType: string
): Promise<{ url: string; pathname: string }> {
  const res = await upload(`social/${userId}/${assetId}-${safeName(name)}`, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    contentType,
    multipart: file.size > 20 * 1024 * 1024,
  });
  return { url: res.url, pathname: res.pathname };
}

/** Make sure an asset has a public URL; uploads from this device's IndexedDB if needed. */
export async function ensureCloudMedia(
  asset: MediaAsset,
  userId: string,
  onUploaded: (id: string, url: string, pathname: string) => void
): Promise<string | null> {
  if (asset.url) return asset.url;
  const blob = await getMediaBlob(asset.id);
  if (!blob) return null;
  let file: Blob = blob;
  let mime = asset.mime || blob.type;
  let name = asset.name;
  if (asset.kind === "image" && mime !== "image/jpeg") {
    const f = await toInstagramFriendlyImage(new File([blob], name, { type: mime }));
    file = f;
    mime = f.type;
    name = f.name;
  }
  const { url, pathname } = await uploadToCloud(userId, asset.id, file, name, mime);
  onUploaded(asset.id, url, pathname);
  return url;
}
