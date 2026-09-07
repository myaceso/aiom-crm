import { NextResponse } from "next/server";

type Body = {
  to?: string;
  body?: string;
  settings?: {
    connected?: boolean;
    botToken?: string;
    defaultChatId?: string;
  };
};

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = payload.settings || {};
  const botToken = (settings.botToken || "").trim();
  const to =
    (payload.to || "").trim() || (settings.defaultChatId || "").trim();
  const message = (payload.body || "").trim();

  if (!settings.connected || !botToken) {
    return NextResponse.json(
      { error: "Connect Telegram in Integrations" },
      { status: 400 }
    );
  }
  if (!to) {
    return NextResponse.json(
      { error: "Chat id is required (or set a default in Integrations)" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: to,
          text: message,
        }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !(data as { ok?: boolean }).ok) {
      return NextResponse.json(
        {
          error:
            (data as { description?: string }).description ||
            "Telegram send failed",
          details: data,
        },
        { status: 502 }
      );
    }
    const result = (data as { result?: { message_id?: number } }).result;
    return NextResponse.json({
      ok: true,
      mode: "live",
      id: result?.message_id != null ? String(result.message_id) : undefined,
      message: "Telegram message sent",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Telegram request failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
