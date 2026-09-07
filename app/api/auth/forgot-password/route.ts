import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth";
import { getUserByEmail } from "@/lib/userDb";
import { createPasswordResetToken } from "@/lib/passwordResetDb";
import { EmailConfigurationError, sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function POST(req: Request) {
  try {
    // Fail closed on missing email config for everyone (no existence leak).
    if (!emailConfigured()) {
      return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: true });
    }

    const user = await getUserByEmail(email);
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : "server_error";
    if (err instanceof EmailConfigurationError || error === "email_not_configured") {
      return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
    }
    return NextResponse.json({ error }, { status: 502 });
  }
}
