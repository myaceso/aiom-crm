import { NextResponse } from "next/server";

const E164 = /^\+[1-9]\d{7,14}$/;

type Body = {
  to?: string;
  body?: string;
  settings?: {
    connected?: boolean;
    phoneNumberId?: string;
    accessToken?: string;
    wabaId?: string;
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
  const phoneNumberId = (settings.phoneNumberId || "").trim();
  const accessToken = (settings.accessToken || "").trim();
  const to = (payload.to || "").trim();
  const message = (payload.body || "").trim();

  if (!settings.connected || !phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "Connect WhatsApp in Integrations" },
      { status: 400 }
    );
  }
  if (!to) {
    return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
  }
  if (!E164.test(to)) {
    return NextResponse.json(
      { error: "Recipient must be E.164, e.g. +15551234567" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const toDigits = to.replace(/\D/g, "");

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toDigits,
          type: "text",
          text: { preview_url: false, body: message },
        }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errObj = data as {
        error?: { message?: string };
        message?: string;
      };
      return NextResponse.json(
        {
          error:
            errObj.error?.message ||
            errObj.message ||
            "WhatsApp send failed",
          details: data,
        },
        { status: 502 }
      );
    }
    const messages = (data as { messages?: { id?: string }[] }).messages;
    return NextResponse.json({
      ok: true,
      mode: "live",
      id: messages?.[0]?.id,
      message: "WhatsApp message sent via Meta Cloud API",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "WhatsApp request failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
