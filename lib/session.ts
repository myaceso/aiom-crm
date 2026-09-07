import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getUserById, toPublicUser } from "./userDb";
import type { SafeUser } from "./types";

export const SESSION_COOKIE = "enone_session";
const SESSION_DAYS = 14;

function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    (!process.env.VERCEL && process.env.NODE_ENV !== "production"
      ? "enone-local-dev-auth-secret-change-me"
      : "");
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET (min 16 chars) is required for session cookies in production."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
};

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSec: number) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export async function setSessionCookie(
  res: NextResponse,
  token: string
): Promise<void> {
  res.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60)
  );
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentSafeUser(): Promise<SafeUser | null> {
  const session = await readSessionFromCookies();
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || !user.active) return null;
  return toPublicUser(user);
}
