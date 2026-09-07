import { NextResponse } from "next/server";
import { countUsers, getUserStoreBackend } from "@/lib/userDb";
import { getCurrentSafeUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userCount = await countUsers();
    const user = await getCurrentSafeUser();
    return NextResponse.json({
      user,
      needsBootstrap: userCount === 0,
      store: getUserStoreBackend(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json(
      {
        user: null,
        needsBootstrap: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
