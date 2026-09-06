import { NextResponse } from "next/server";

type Body = {
  body?: string;
  channels?: string[];
  connections?: Array<{
    id: string;
    connected?: boolean;
    handle?: string;
    profileUrl?: string;
    accessToken?: string;
  }>;
};

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (payload.body || "").trim();
  const channels = Array.isArray(payload.channels) ? payload.channels : [];
  const connections = Array.isArray(payload.connections)
    ? payload.connections
    : [];

  if (!text) {
    return NextResponse.json({ error: "Post body is required" }, { status: 400 });
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

  // Stub: real Meta/LinkedIn/X APIs later. Record success when channels connected.
  return NextResponse.json({
    ok: true,
    mode: "stub",
    published: channels,
    message: "Published (stub). Real network APIs can use saved tokens later.",
  });
}
