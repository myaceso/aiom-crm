import { NextResponse } from "next/server";
import {
  ALL_PERMISSIONS,
  hashPassword,
  isAdmin,
  normalizeEmail,
} from "@/lib/auth";
import { getUserById, listUsers, saveUser, toPublicUser } from "@/lib/userDb";
import { getCurrentSafeUser } from "@/lib/session";
import type { PermissionKey, UserRole } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentSafeUser();
    if (!isAdmin(me)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const id = params.id;
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = await req.json();
    let nextEmail = target.email;
    if (typeof body?.email === "string") {
      nextEmail = normalizeEmail(body.email);
      const all = await listUsers();
      if (all.some((u) => u.id !== id && u.email === nextEmail)) {
        return NextResponse.json({ error: "email_taken" }, { status: 409 });
      }
    }

    let passwordHash = target.passwordHash;
    if (typeof body?.password === "string" && body.password.length > 0) {
      if (body.password.length < 4) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      passwordHash = await hashPassword(body.password);
    }

    const nextRole: UserRole =
      body?.role === "admin" || body?.role === "staff"
        ? body.role
        : target.role;

    const nextActive =
      typeof body?.active === "boolean" ? body.active : target.active;

    if (
      target.role === "admin" &&
      target.active &&
      (nextActive === false || nextRole !== "admin")
    ) {
      const all = await listUsers();
      const otherAdmins = all.filter(
        (u) => u.id !== id && u.role === "admin" && u.active
      );
      if (otherAdmins.length === 0) {
        return NextResponse.json({ error: "last_admin" }, { status: 400 });
      }
    }

    const nextPermissions =
      nextRole === "admin"
        ? [...ALL_PERMISSIONS]
        : Array.isArray(body?.permissions)
          ? body.permissions.filter((p: unknown): p is PermissionKey =>
              ALL_PERMISSIONS.includes(p as PermissionKey)
            ).filter((p: PermissionKey) => p !== "users")
          : target.permissions.filter((p) => p !== "users");

    const updated = {
      ...target,
      name:
        typeof body?.name === "string" ? body.name.trim() : target.name,
      email: nextEmail,
      passwordHash,
      role: nextRole,
      permissions: nextPermissions,
      active: nextActive,
      emailVerifiedAt:
        nextActive && !target.emailVerifiedAt
          ? new Date().toISOString()
          : target.emailVerifiedAt,
    };
    await saveUser(updated);
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentSafeUser();
    if (!isAdmin(me)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const id = params.id;
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (target.role === "admin" && target.active) {
      const all = await listUsers();
      const otherAdmins = all.filter(
        (u) => u.id !== id && u.role === "admin" && u.active
      );
      if (otherAdmins.length === 0) {
        return NextResponse.json({ error: "last_admin" }, { status: 400 });
      }
    }

    const updated = { ...target, active: false };
    await saveUser(updated);
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
