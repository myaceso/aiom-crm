import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: {
    provider?: string;
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = (body.provider || "resend").toLowerCase();
  const apiKey = (body.apiKey || "").trim();
  const fromEmail = (body.fromEmail || "").trim();
  const fromName = (body.fromName || "").trim();

  if (!apiKey || !fromEmail || !fromName) {
    return NextResponse.json(
      { error: "Provider, API key, from email and from name are required" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(fromEmail)) {
    return NextResponse.json({ error: "Invalid from email" }, { status: 400 });
  }
  if (provider !== "resend" && provider !== "sendgrid") {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    provider,
    message: `Format OK for ${provider}. Connect to use send; live API keys are verified on send.`,
  });
}
