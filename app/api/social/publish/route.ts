import { NextResponse } from "next/server";

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
  connections?: Array<{
    id: string;
    connected?: boolean;
    handle?: string;
    profileUrl?: string;
    accessToken?: string;
  }>;
};

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  let payload: Body = {};
  let mediaFromForm: MediaMeta[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const bodyText = String(form.get("body") || "");
      const channelsRaw = String(form.get("channels") || "[]");
      const connectionsRaw = String(form.get("connections") || "[]");
      const mediaMetaRaw = String(form.get("mediaMeta") || "[]");
      let channels: string[] = [];
      let connections: Body["connections"] = [];
      let mediaMeta: MediaMeta[] = [];
      try {
        channels = JSON.parse(channelsRaw);
      } catch {
        channels = [];
      }
      try {
        connections = JSON.parse(connectionsRaw);
      } catch {
        connections = [];
      }
      try {
        mediaMeta = JSON.parse(mediaMetaRaw);
      } catch {
        mediaMeta = [];
      }
      // Count attached binary parts (ready for real network upload later)
      const files = form.getAll("media").filter((v) => typeof v !== "string");
      mediaFromForm = mediaMeta.length
        ? mediaMeta
        : files.map((f, i) => {
            const file = f as File;
            return {
              id: `form-${i}`,
              kind: file.type.startsWith("video/") ? "video" : "image",
              name: file.name,
              size: file.size,
              mime: file.type,
            };
          });
      payload = { body: bodyText, channels, connections, media: mediaFromForm };
    } else {
      payload = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = (payload.body || "").trim();
  const channels = Array.isArray(payload.channels) ? payload.channels : [];
  const connections = Array.isArray(payload.connections)
    ? payload.connections
    : [];
  const media = Array.isArray(payload.media)
    ? payload.media
    : mediaFromForm.length
      ? mediaFromForm
      : [];
  const mediaCount =
    typeof payload.mediaCount === "number" ? payload.mediaCount : media.length;

  if (!text && mediaCount === 0) {
    return NextResponse.json(
      { error: "Post body or media is required" },
      { status: 400 }
    );
  }
  if (channels.length === 0) {
    return NextResponse.json(
      { error: "Select at least one channel" },
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
        error: "Connect at least one network in Integrations",
        missing,
      },
      { status: 400 }
    );
  }

  // Stub: real Meta/LinkedIn/X APIs later. Record success + media metadata.
  // Access tokens on connections are available when wiring live publishers.
  return NextResponse.json({
    ok: true,
    mode: "stub",
    published: channels,
    mediaIncluded: mediaCount > 0,
    mediaCount,
    media: media.map((m) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      size: m.size,
      mime: m.mime,
    })),
    message:
      mediaCount > 0
        ? `Published with ${mediaCount} media file(s) (stub). Real network APIs can use saved tokens later.`
        : "Published (stub). Real network APIs can use saved tokens later.",
  });
}
