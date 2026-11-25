import { openAiSize } from "../prompt";
import type { ImageGenInput } from "./types";
import { ProviderError } from "./types";

function clip(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function generateOpenAiImage(
  input: ImageGenInput,
  apiKey: string
): Promise<{ bytes: Buffer; mime: string; remoteUrl?: string }> {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.6-flare";
  const quality = process.env.OPENAI_IMAGE_QUALITY?.trim() || "medium";
  const response = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      size: openAiSize(input.aspectRatio),
      quality,
      output_format: "jpeg",
      output_compression: 85,
      background: "opaque",
      n: 1,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: { b64_json?: string; url?: string }[];
  };
  if (!response.ok) {
    const message = clip(data.error?.message || `OpenAI ${response.status}`);
    throw new ProviderError(message, response.status === 401 || response.status === 403 ? "auth" : "provider");
  }
  const first = data.data?.[0];
  if (first?.b64_json) {
    const bytes = Buffer.from(first.b64_json, "base64");
    if (bytes.length < 32) throw new ProviderError("OpenAI devolvió una imagen vacía.", "provider");
    return { bytes, mime: "image/jpeg" };
  }
  if (first?.url) return { bytes: Buffer.alloc(0), mime: "image/jpeg", remoteUrl: first.url };
  throw new ProviderError("OpenAI no devolvió una imagen.", "provider");
}
