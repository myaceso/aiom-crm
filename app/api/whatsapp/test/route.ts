import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: {
    phoneNumberId?: string;
    accessToken?: string;
    wabaId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneNumberId = (body.phoneNumberId || "").trim();
  const accessToken = (body.accessToken || "").trim();

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "Phone Number ID and Access Token are required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const info = data as {
        display_phone_number?: string;
        verified_name?: string;
      };
      const label = [info.verified_name, info.display_phone_number]
        .filter(Boolean)
        .join(" · ");
      return NextResponse.json({
        ok: true,
        live: true,
        message: label ? `WhatsApp OK: ${label}` : "WhatsApp Cloud API OK",
      });
    }
    const errMsg =
      (data as { error?: { message?: string } }).error?.message ||
      `Meta returned ${res.status}`;
    return NextResponse.json({
      ok: true,
      live: false,
      message: `Format OK. Meta rejected credentials (${errMsg}). You can still Connect for demo; fix token for live send.`,
      metaStatus: res.status,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      live: false,
      message:
        "Format OK. Could not reach Meta; Connect is still allowed for demo.",
    });
  }
}
