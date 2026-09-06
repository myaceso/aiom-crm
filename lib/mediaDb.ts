"use client";

import { get, set, del, keys } from "idb-keyval";

const PREFIX = "enone-media:";

function keyFor(id: string) {
  return `${PREFIX}${id}`;
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  await set(keyFor(id), blob);
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(keyFor(id));
}

export async function deleteMediaBlob(id: string): Promise<void> {
  await del(keyFor(id));
}

export async function listMediaBlobIds(): Promise<string[]> {
  const all = await keys();
  return all
    .map(String)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length));
}

/** Create an object URL for a stored blob; caller must revoke when done. */
export async function createPreviewUrl(id: string): Promise<string | null> {
  const blob = await getMediaBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
