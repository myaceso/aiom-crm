function paypalBaseUrl(): string {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal auth missing access_token");
  return data.access_token;
}

export async function paypalCreateOrder(input: {
  amountCents: number;
  userId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string | null }> {
  const token = await getPayPalAccessToken();
  const value = (input.amountCents / 100).toFixed(2);
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value,
          },
          custom_id: input.userId,
          description: "enone CRM subscription",
        },
      ],
      application_context: {
        brand_name: "enone",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    id: string;
    links?: { rel: string; href: string }[];
  };
  const approveUrl =
    data.links?.find((l) => l.rel === "approve")?.href || null;
  return { id: data.id, approveUrl };
}

export async function paypalCaptureOrder(orderId: string): Promise<{
  id: string;
  status: string;
  amountCents: number;
  customId: string | null;
}> {
  const token = await getPayPalAccessToken();
  const res = await fetch(
    `${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    id: string;
    status: string;
    purchase_units?: {
      custom_id?: string;
      payments?: {
        captures?: { amount?: { value?: string; currency_code?: string } }[];
      };
    }[];
  };
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const valueStr = capture?.amount?.value || "0";
  const amountCents = Math.round(parseFloat(valueStr) * 100);
  return {
    id: data.id,
    status: data.status,
    amountCents,
    customId: unit?.custom_id || null,
  };
}
