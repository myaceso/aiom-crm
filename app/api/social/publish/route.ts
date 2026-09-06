import { NextResponse } from "next/server";
import {
  publishToChannels,
  type MediaFile,
  type PublishConnection,
} from "@/lib/metaPublish";

type MediaMeta = {
  id?: string;
  kind?: string;
  name?: string;
  size?: number;
  mime?: string;
};

type Body = {
  body?: string;
  channels?: string[];
  media?: MediaMeta[];
  mediaCount?: number;
  connections?: PublishConnection[];
  lang?: string;
};

function metaTokenHint(lang?: string) {
  return lang === "es"
    ? "Conecta un Access Token de Meta (Facebook/Instagram) para publicar de verdad"
    : "Connect a Meta Access Token (Facebook/Instagram) to publish for real";
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  let text = "";
  let channels: string[] = [];
  let connections: PublishConnection[] = [];
  let lang = "en";
  const mediaFiles: MediaFile[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = String(form.get("body") || "").trim();
      lang = String(form.get("lang") || "en");
      try {
        channels = JSON.parse(String(form.get("channels") || "[]"));
      } catch {
        channels = [];
      }
      try {
        connections = JSON.parse(String(form.get("connections") || "[]"));
      } catch {
        connections = [];
      }

      const files = form.getAll("media").filter((v) => typeof v !== "string") as File[];
      let mediaMeta: MediaMeta[] = [];
      try {
        mediaMeta = JSON.parse(String(form.get("mediaMeta") || "[]"));
      } catch {
        mediaMeta = [];
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = mediaMeta[i];
        const mime = file.type || meta?.mime || "application/octet-stream";
        const kind: "image" | "video" = mime.startsWith("video/")
          ? "video"
          : "image";
        mediaFiles.push({
          blob: file,
          name: file.name || meta?.name || `media-${i}`,
          mime,
          kind: (meta?.kind as "image" | "video") || kind,
        });
      }
    } else {
      const payload = (await req.json()) as Body;
      text = (payload.body || "").trim();
      channels = Array.isArray(payload.channels) ? payload.channels : [];
      connections = Array.isArray(payload.connections)
        ? payload.connections
        : [];
      lang = payload.lang || "en";
      // JSON-only: no binary media available for upload
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text && mediaFiles.length === 0) {
    return NextResponse.json(
      {
        error:
          lang === "es"
            ? "Escribe un mensaje o adjunta medios"
            : "Post body or media is required",
      },
      { status: 400 }
    );
  }
  if (!Array.isArray(channels) || channels.length === 0) {
    return NextResponse.json(
      {
        error:
          lang === "es"
            ? "Selecciona al menos un canal"
            : "Select at least one channel",
      },
      { status: 400 }
    );
  }

  const connectedIds = new Set(
    connections.filter((c) => c.connected).map((c) => c.id)
  );
  const missing = channels.filter((ch) => !connectedIds.has(ch));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error:
          lang === "es"
            ? "Conecta al menos una red en Integraciones"
            : "Connect at least one network in Integrations",
        missing,
      },
      { status: 400 }
    );
  }

  // Gate: Publish Now requires a real Meta token for FB/IG selection
  const selectedMeta = channels.filter(
    (ch) => ch === "facebook" || ch === "instagram"
  );
  const metaWithoutToken = selectedMeta.filter((ch) => {
    const c = connections.find((x) => x.id === ch);
    return !c?.accessToken?.trim();
  });

  // If user only selected LinkedIn/X/etc., fail clearly (no stub success)
  const onlyOauth = channels.every(
    (ch) => !["facebook", "instagram"].includes(ch)
  );
  if (onlyOauth) {
    return NextResponse.json(
      {
        ok: false,
        error:
          lang === "es"
            ? "LinkedIn/X/TikTok/GBP requieren OAuth de app. Usa Facebook o Instagram con Access Token de Meta."
            : "LinkedIn/X/TikTok/GBP need app OAuth. Use Facebook or Instagram with a Meta Access Token.",
        results: channels.map((id) => ({
          id,
          ok: false,
          reason: "needs_oauth_app",
        })),
      },
      { status: 400 }
    );
  }

  if (selectedMeta.length > 0 && metaWithoutToken.length === selectedMeta.length) {
    return NextResponse.json(
      {
        ok: false,
        error: metaTokenHint(lang),
        results: channels.map((id) => ({
          id,
          ok: false,
          reason:
            id === "facebook" || id === "instagram"
              ? "needs_meta_token"
              : "needs_oauth_app",
        })),
      },
      { status: 400 }
    );
  }

  const { results, succeeded, failed } = await publishToChannels({
    body: text,
    channels,
    connections,
    media: mediaFiles,
  });

  if (succeeded.length === 0) {
    const tokenFail = results.some((r) => r.reason === "needs_meta_token");
    const firstDetail =
      results.find((r) => r.detail)?.detail ||
      results.find((r) => r.reason)?.reason;
    return NextResponse.json(
      {
        ok: false,
        error: tokenFail
          ? metaTokenHint(lang)
          : firstDetail ||
            (lang === "es" ? "Error al publicar" : "Publish failed"),
        results,
        published: [],
        failed,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "live",
    published: succeeded,
    failed,
    results,
    message:
      lang === "es"
        ? `Publicado en: ${succeeded.join(", ")}${
            failed.length ? ` · Falló: ${failed.join(", ")}` : ""
          }`
        : `Published to: ${succeeded.join(", ")}${
            failed.length ? ` · Failed: ${failed.join(", ")}` : ""
          }`,
  });
}
