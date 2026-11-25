import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferRedirectUri, exchangeAuthCode, requestOrigin } from "@/lib/buffer/oauth";
import { takeOAuthPending } from "@/lib/buffer/persist";
import { storeOAuthTokens } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const back = (code: string) => NextResponse.redirect(new URL(`/dashboard/integrations?buffer=${code}`, origin));
  const url = new URL(req.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError === "access_denied") return back("denied");
  if (oauthError) return back("oauth_error");

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const pending = state ? await takeOAuthPending(state) : null;
  const auth = await requireUser(["integrations"]);
  if (auth.error || !pending || pending.userId !== auth.user.id || pending.exp < Date.now() || !code) {
    return back("oauth_state");
  }
  try {
    const pair = await exchangeAuthCode({ code, verifier: pending.verifier, redirectUri: bufferRedirectUri(req) });
    await storeOAuthTokens(auth.user.id, pair);
    return back("ok");
  } catch (e) {
    console.error("[buffer/oauth]", e);
    return back("oauth_error");
  }
}
