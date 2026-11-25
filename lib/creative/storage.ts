import { promises as fs } from "fs";
import path from "path";

function extFor(mime: string): string {
  if (mime === "video/mp4") return "mp4";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(value)) throw new Error("bad_id");
  return value;
}

function localRoot(): string {
  return path.join(process.cwd(), ".data", "creative");
}

export function localFilePath(userId: string, assetId: string, mime: string): string {
  const root = path.resolve(localRoot());
  const full = path.resolve(root, safeId(userId), `${safeId(assetId)}.${extFor(mime)}`);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("bad_path");
  return full;
}

export async function storeMedia(
  userId: string,
  assetId: string,
  bytes: Buffer,
  mime: string,
  folder = "creative"
): Promise<{ url: string; pathname: string }> {
  const id = safeId(assetId);
  const owner = safeId(userId);
  const ext = extFor(mime);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const pathname = `${folder}/${owner}/${id}.${ext}`;
    const blob = await put(pathname, bytes, {
      access: "public",
      contentType: mime,
      token,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  }
  const full = localFilePath(owner, id, mime);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  return { url: `/api/marketing/creative/file/${id}`, pathname: `local/${owner}/${id}.${ext}` };
}

export async function readLocalMedia(userId: string, assetId: string, mime: string): Promise<Buffer> {
  return fs.readFile(localFilePath(userId, assetId, mime));
}

export async function removeStored(pathname: string, url: string, userId: string, assetId: string, mime: string): Promise<void> {
  if (pathname.startsWith("local/")) {
    await fs.unlink(localFilePath(userId, assetId, mime)).catch(() => undefined);
    return;
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && url.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(url, { token }).catch(() => undefined);
  }
}
