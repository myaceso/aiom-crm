import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { authorizeUrl, oauthConfigured, pkcePair, randomState, requestOrigin } from "@/lib/buffer/oauth";
import { saveOAuthPending } from "@/lib/buffer/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const auth = await requireUser(["integrations"]);
  if (auth.error) return NextResponse.redirect(new URL("/login", origin));
  if (!oauthConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/integrations?buffer=oauth_missing", origin));
  }
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  await saveOAuthPending(state, { userId: auth.user.id, verifier, exp: Date.now() + 10 * 60 * 1000 });
  return NextResponse.redirect(authorizeUrl(req, state, challenge));
}
