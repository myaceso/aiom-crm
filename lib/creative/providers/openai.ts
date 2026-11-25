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

function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.6-flare";
}

function imageQuality() {
  return process.env.OPENAI_IMAGE_QUALITY?.trim() || "medium";
}

async function readImagePayload(response: Response): Promise<{ bytes: Buffer; mime: string; remoteUrl?: string }> {
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

/** Edit an existing image. Public https URLs are sent as JSON; local files go as multipart. */
export async function editOpenAiImage(input: {
  prompt: string;
  aspectRatio: string;
  bytes?: Buffer;
  mime?: string;
  imageUrl?: string;
  apiKey: string;
}): Promise<{ bytes: Buffer; mime: string; remoteUrl?: string }> {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const size = openAiSize(input.aspectRatio);
  const quality = imageQuality();
  const model = imageModel();
  let response: Response;
  if (input.imageUrl) {
    response = await fetch(`${base}/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        images: [{ image_url: input.imageUrl }],
        size,
        quality,
        output_format: "jpeg",
        output_compression: 85,
        n: 1,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } else if (input.bytes && input.bytes.length > 32) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", input.prompt);
    form.set("size", size);
    form.set("quality", quality);
    form.set("output_format", "jpeg");
    form.set("output_compression", "85");
    form.set("n", "1");
    const type = input.mime && input.mime.startsWith("image/") ? input.mime : "image/jpeg";
    form.set("image[]", new Blob([new Uint8Array(input.bytes)], { type }), "source.jpg");
    response = await fetch(`${base}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } else {
    throw new ProviderError("No hay una imagen de origen para editar.", "invalid");
  }
  return readImagePayload(response);
}
