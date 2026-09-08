import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { getBilling, markUserPaid } from "@/lib/billingDb";

export const runtime = "nodejs";

/** Confirm a Checkout Session after redirect (complements webhook). */
export async function POST(req: Request) {
  try {
    const user = await getCurrentSafeUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: unknown;
    };
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUserId =
      session.client_reference_id || session.metadata?.userId || "";
    if (sessionUserId && sessionUserId !== user.id) {
      return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
    }
    if (session.payment_status !== "paid") {
      const billing = await getBilling(user.id);
      return NextResponse.json({ billing, paid: false });
    }
    const amountCents =
      typeof session.amount_total === "number"
        ? session.amount_total
        : parseInt(session.metadata?.amountCents || "0", 10);
    if (amountCents < 100) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }
    const billing = await markUserPaid(user.id, {
      amountCents,
      provider: "stripe",
      externalId: session.id,
    });
    return NextResponse.json({ billing, paid: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
