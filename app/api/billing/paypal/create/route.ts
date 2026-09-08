import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { parseAmountCents, appBaseUrl } from "@/lib/billing";
import { paypalCreateOrder } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentSafeUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      amountCents?: unknown;
    };
    const amountCents = parseAmountCents(body.amountCents);
    if (amountCents == null) {
      return NextResponse.json(
        { error: "invalid_amount", message: "Amount must be at least $1 USD" },
        { status: 400 }
      );
    }

    const base = appBaseUrl();
    const order = await paypalCreateOrder({
      amountCents,
      userId: user.id,
      returnUrl: `${base}/dashboard/billing?provider=paypal&capture=1`,
      cancelUrl: `${base}/dashboard/billing?canceled=1&provider=paypal`,
    });

    return NextResponse.json({
      orderId: order.id,
      approveUrl: order.approveUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
