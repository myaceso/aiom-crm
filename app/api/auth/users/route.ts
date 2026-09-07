import { NextResponse } from "next/server";
import {
  ALL_PERMISSIONS,
  hashPassword,
  isAdmin,
  normalizeEmail,
} from "@/lib/auth";
import {
  buildStaffUser,
  listUsers,
  saveUser,
  toPublicUser,
} from "@/lib/userDb";
import { getCurrentSafeUser } from "@/lib/session";
import type { PermissionKey, UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const me = await getCurrentSafeUser();
    if (!isAdmin(me)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const users = await listUsers();
    return NextResponse.json({ users: users.map(toPublicUser) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentSafeUser();
    if (!isAdmin(me)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(
      typeof body?.email === "string" ? body.email : ""
    );
    const password = typeof body?.password === "string" ? body.password : "";
    const role: UserRole = body?.role === "admin" ? "admin" : "staff";
    const permissions: PermissionKey[] = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: unknown): p is PermissionKey =>
          ALL_PERMISSIONS.includes(p as PermissionKey)
        )
      : [];

    if (!name || !email || password.length < 4) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const existing = await listUsers();
    if (existing.some((u) => u.email === email)) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = buildStaffUser({
      name,
      email,
      passwordHash,
      role,
      permissions,
    });
    await saveUser(user);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
