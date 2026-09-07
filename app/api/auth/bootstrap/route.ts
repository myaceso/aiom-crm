import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import {
  buildAdminUser,
  countUsers,
  saveUser,
  toPublicUser,
} from "@/lib/userDb";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(
      typeof body?.email === "string" ? body.email : ""
    );
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !email || password.length < 4) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const existing = await countUsers();
    if (existing > 0) {
      return NextResponse.json({ error: "users_exist" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = buildAdminUser({ name, email, passwordHash });
    await saveUser(user);

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
