import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: {
    botToken?: string;
    defaultChatId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const botToken = (body.botToken || "").trim();
  if (!botToken) {
    return NextResponse.json(
      { error: "Bot Token is required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data as { ok?: boolean }).ok) {
      const result = (data as {
        result?: { username?: string; first_name?: string };
      }).result;
      const label = result?.username
        ? `@${result.username}`
        : result?.first_name || "bot";
      return NextResponse.json({
        ok: true,
        live: true,
        message: `Telegram OK: ${label}`,
      });
    }
    return NextResponse.json({
      ok: true,
      live: false,
      message:
        "Format OK. Telegram rejected the token (you can still Connect for demo; fix token for live send).",
      telegramStatus: res.status,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      live: false,
      message:
        "Format OK. Could not reach Telegram; Connect is still allowed for demo.",
    });
  }
}
