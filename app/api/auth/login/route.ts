import { NextResponse } from "next/server";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { getUserByEmail, toPublicUser } from "@/lib/userDb";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(
      typeof body?.email === "string" ? body.email : ""
    );
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    const res = NextResponse.json({ user: toPublicUser(user) });
    await setSessionCookie(res, token);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
