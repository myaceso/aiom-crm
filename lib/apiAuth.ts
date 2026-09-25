import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "./session";
import { hasPermission } from "./auth";
import type { PermissionKey, SafeUser } from "./types";

/** Returns the signed-in user if they have ANY of the given permissions, else a JSON error response. */
export async function requireUser(
  perms: PermissionKey[]
): Promise<{ user: SafeUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const user = await getCurrentSafeUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (perms.length && !perms.some((p) => hasPermission(user, p)))
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
