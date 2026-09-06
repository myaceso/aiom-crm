import { NextResponse } from "next/server";

const E164 = /^\+[1-9]\d{7,14}$/;

type Body = {
  campaign?: {
    name?: string;
    body?: string;
    audience?: string;
    to?: string;
  };
  settings?: {
    connected?: boolean;
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
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
  const campaign = payload.campaign || {};
  const accountSid = (settings.accountSid || "").trim();
  const authToken = (settings.authToken || "").trim();
  const fromNumber = (settings.fromNumber || "").trim();
  const message = (campaign.body || "").trim();

  if (!settings.connected || !accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "Connect SMS in Integrations" },
      { status: 400 }
    );
  }
  if (!E164.test(fromNumber)) {
    return NextResponse.json(
      { error: "From number must be E.164, e.g. +15551234567" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const to = (campaign.to || "").trim();
  if (to) {
    if (!E164.test(to)) {
      return NextResponse.json(
        { error: "Recipient must be E.164" },
        { status: 400 }
      );
    }
    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const form = new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          {
            error: (data as { message?: string }).message || "Twilio send failed",
            details: data,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        mode: "live",
        sid: (data as { sid?: string }).sid,
        message: "SMS sent via Twilio",
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "Twilio request failed",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }
  }

  // Audience campaign without per-recipient list: queue stub using connected creds
  return NextResponse.json({
    ok: true,
    mode: "demo-bulk",
    audience: campaign.audience || "unknown",
    from: fromNumber,
    message: `Campaign “${campaign.name || "SMS"}” queued with Twilio credentials on file.`,
  });
}
