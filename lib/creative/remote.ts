function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  const n = m.slice(1).map((part) => Number(part));
  if (n.some((part) => part > 255)) return true;
  const [a, b] = n;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function httpsUrl(raw: string, allow: (hostname: string) => boolean): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (isPrivateHost(url.hostname) || !allow(url.hostname.toLowerCase())) return null;
  return url;
}

export function isQueueUrl(raw: string): boolean {
  return !!httpsUrl(raw, (host) => host === "queue.fal.run");
}

export function isFalMediaUrl(raw: string): boolean {
  return !!httpsUrl(raw, (host) => host === "fal.media" || host.endsWith(".fal.media"));
}

export function isPublicHttps(raw: string): boolean {
  return !!httpsUrl(raw, () => true);
}

const MEDIA_HOST = (host: string) =>
  host === "fal.media" ||
  host.endsWith(".fal.media") ||
  host.endsWith(".fal.ai") ||
  host === "fal.ai" ||
  host === "storage.googleapis.com" ||
  host.endsWith(".storage.googleapis.com") ||
  host.endsWith(".oaiusercontent.com") ||
  host.endsWith(".openai.com") ||
  host.endsWith(".blob.vercel-storage.com");

async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new Error("empty_body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Download a provider file, following only HTTPS redirects to allowed hosts. */
export async function downloadRemote(raw: string, maxBytes: number): Promise<{ bytes: Buffer; mime: string }> {
  let current = httpsUrl(raw, MEDIA_HOST);
  if (!current) throw new Error("bad_url");
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) throw new Error("bad_redirect");
      current = httpsUrl(new URL(next, current).toString(), MEDIA_HOST);
      if (!current) throw new Error("bad_redirect");
      continue;
    }
    if (!response.ok) throw new Error("download_failed");
    const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = await readLimited(response, maxBytes);
    return { bytes, mime };
  }
  throw new Error("too_many_redirects");
}
