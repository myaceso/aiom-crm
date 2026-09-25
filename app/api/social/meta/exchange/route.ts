import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { exchangeForPageTokens, explainGraphError } from "@/lib/metaPublish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export async function GET() {
  const auth = await requireUser(["integrations", "marketing"]);
  if (auth.error) return auth.error;
  return NextResponse.json({ configured: configured() });
}

/** POST { userToken } → long-lived user token → Pages with non-expiring Page tokens. */
export async function POST(req: Request) {
  const auth = await requireUser(["integrations"]);
  if (auth.error) return auth.error;
  if (!configured())
    return NextResponse.json(
      {
        configured: false,
        error:
          "El servidor no tiene META_APP_ID / META_APP_SECRET. Usa el método manual: Access Token Debugger → «Extender token» y luego /me/accounts en Graph API Explorer.",
      },
      { status: 501 }
    );
  const body = (await req.json().catch(() => ({}))) as { userToken?: string };
  const userToken = String(body.userToken || "").trim();
  if (!userToken) return NextResponse.json({ error: "Pega un token de usuario" }, { status: 400 });
  try {
    const data = await exchangeForPageTokens(userToken);
    return NextResponse.json({ configured: true, ...data });
  } catch (e) {
    return NextResponse.json({ configured: true, error: explainGraphError(e) }, { status: 400 });
  }
}
