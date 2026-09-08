import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { parseAmountCents, appBaseUrl } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

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

    const stripe = getStripe();
    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "enone CRM subscription",
              description: "One-time enone subscription payment",
            },
          },
        },
      ],
      success_url: `${base}/dashboard/billing?success=1&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/billing?canceled=1&provider=stripe`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        amountCents: String(amountCents),
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
