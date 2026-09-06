import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  campaign?: {
    name?: string;
    subject?: string;
    body?: string;
    audience?: string;
    to?: string;
  };
  settings?: {
    connected?: boolean;
    provider?: string;
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
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
  const provider = (settings.provider || "resend").toLowerCase();
  const apiKey = (settings.apiKey || "").trim();
  const fromEmail = (settings.fromEmail || "").trim();
  const fromName = (settings.fromName || "").trim();
  const subject = (campaign.subject || "").trim();
  const html = (campaign.body || "").trim();

  if (!settings.connected || !apiKey || !fromEmail || !fromName) {
    return NextResponse.json(
      { error: "Connect Email in Integrations" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(fromEmail)) {
    return NextResponse.json({ error: "Invalid from email" }, { status: 400 });
  }
  if (!subject || !html) {
    return NextResponse.json(
      { error: "Subject and body are required" },
      { status: 400 }
    );
  }

  const to = (campaign.to || "").trim();
  if (to) {
    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
    }

    try {
      if (provider === "resend") {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [to],
            subject,
            html: html.replace(/\n/g, "<br/>"),
          }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return NextResponse.json(
            {
              error:
                (data as { message?: string }).message || "Resend send failed",
              details: data,
            },
            { status: 502 }
          );
        }
        return NextResponse.json({
          ok: true,
          mode: "live",
          provider: "resend",
          id: (data as { id?: string }).id,
          message: "Email sent via Resend",
        });
      }

      if (provider === "sendgrid") {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail, name: fromName },
            subject,
            content: [
              {
                type: "text/html",
                value: html.replace(/\n/g, "<br/>"),
              },
            ],
          }),
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return NextResponse.json(
            { error: "SendGrid send failed", details: text },
            { status: 502 }
          );
        }
        return NextResponse.json({
          ok: true,
          mode: "live",
          provider: "sendgrid",
          message: "Email sent via SendGrid",
        });
      }

      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    } catch (err) {
      return NextResponse.json(
        {
          error: "Email provider request failed",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "demo-bulk",
    provider,
    audience: campaign.audience || "unknown",
    from: fromEmail,
    message: `Campaign “${campaign.name || "Email"}” queued with ${provider} credentials on file.`,
  });
}
