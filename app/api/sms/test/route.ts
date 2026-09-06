import { NextResponse } from "next/server";

const E164 = /^\+[1-9]\d{7,14}$/;

export async function POST(req: Request) {
  let body: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountSid = (body.accountSid || "").trim();
  const authToken = (body.authToken || "").trim();
  const fromNumber = (body.fromNumber || "").trim();

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "Account SID, Auth Token and From number are required" },
      { status: 400 }
    );
  }
  if (!E164.test(fromNumber)) {
    return NextResponse.json(
      { error: "Use E.164 format, e.g. +15551234567" },
      { status: 400 }
    );
  }

  // Optional live ping against Twilio account
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
      {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { friendly_name?: string; status?: string };
      return NextResponse.json({
        ok: true,
        live: true,
        message: `Twilio OK${data.friendly_name ? `: ${data.friendly_name}` : ""}`,
        status: data.status,
      });
    }
    // Invalid credentials still "format OK" for demo connect flow
    return NextResponse.json({
      ok: true,
      live: false,
      message:
        "Format OK. Twilio rejected credentials (you can still Connect for demo; fix keys for live send).",
      twilioStatus: res.status,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      live: false,
      message: "Format OK. Could not reach Twilio; Connect is still allowed for demo.",
    });
  }
}
