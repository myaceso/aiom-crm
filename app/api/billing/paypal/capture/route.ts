import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { paypalCaptureOrder } from "@/lib/paypal";
import { markUserPaid } from "@/lib/billingDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentSafeUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      orderId?: unknown;
    };
    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return NextResponse.json({ error: "missing_order_id" }, { status: 400 });
    }

    const captured = await paypalCaptureOrder(orderId);
    if (captured.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "not_completed", status: captured.status },
        { status: 400 }
      );
    }
    if (captured.customId && captured.customId !== user.id) {
      return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
    }
    if (captured.amountCents < 100) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }

    const billing = await markUserPaid(user.id, {
      amountCents: captured.amountCents,
      provider: "paypal",
      externalId: captured.id,
    });

    return NextResponse.json({ billing, orderId: captured.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
