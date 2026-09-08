import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { markUserPaid } from "@/lib/billingDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = getStripeWebhookSecret();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      session.client_reference_id ||
      session.metadata?.userId ||
      "";
    const amountCents =
      typeof session.amount_total === "number"
        ? session.amount_total
        : parseInt(session.metadata?.amountCents || "0", 10);
    if (userId && amountCents > 0 && session.payment_status === "paid") {
      await markUserPaid(userId, {
        amountCents,
        provider: "stripe",
        externalId: session.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
