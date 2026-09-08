import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { getBilling } from "@/lib/billingDb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentSafeUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const billing = await getBilling(user.id);
    return NextResponse.json({ billing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
