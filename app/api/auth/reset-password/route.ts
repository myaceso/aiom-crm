import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getUserById, saveUser } from "@/lib/userDb";
import { consumePasswordResetToken } from "@/lib/passwordResetDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (password.length < 8) {
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    }

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }

    await saveUser({
      ...user,
      passwordHash: await hashPassword(password),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
