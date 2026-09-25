import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getCrmState } from "@/lib/crmDb";
import { metaSetupFromCrm } from "@/lib/socialPublisher";
import { debugToken, explainGraphError, REQUIRED_SCOPES, resolvePageContext } from "@/lib/metaPublish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { accessToken?, pageId?, igUserId? } — validates the token (read-only, never posts). Falls back to saved creds. */
export async function POST(req: Request) {
  const auth = await requireUser(["integrations", "marketing"]);
  if (auth.error) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { accessToken?: string; pageId?: string; igUserId?: string };
  let creds = {
    accessToken: String(body.accessToken || "").trim(),
    pageId: String(body.pageId || "").trim(),
    igUserId: String(body.igUserId || "").trim(),
  };
  if (!creds.accessToken) {
    const saved = metaSetupFromCrm(await getCrmState(auth.user.id)).creds;
    creds = {
      accessToken: saved.accessToken,
      pageId: creds.pageId || saved.pageId || "",
      igUserId: creds.igUserId || saved.igUserId || "",
    };
  }
  if (!creds.accessToken)
    return NextResponse.json({ ok: false, error: "Pega el Access Token de Meta primero." }, { status: 400 });

  try {
    const ctx = await resolvePageContext(creds);
    const info = await debugToken(ctx.pageToken);
    const warnings = [...ctx.warnings];
    if (info?.scopes?.length) {
      const missing = REQUIRED_SCOPES.filter((s) => !info.scopes!.includes(s));
      if (missing.length) warnings.push(`Permisos que faltan en el token: ${missing.join(", ")}`);
    }
    if (info?.expiresAt) warnings.push(`El token caduca el ${new Date(info.expiresAt).toLocaleString("es-US", { timeZone: "America/New_York" })} (ET).`);
    return NextResponse.json({
      ok: true,
      tokenKind: ctx.tokenKind,
      page: { id: ctx.pageId, name: ctx.pageName || ctx.pageId },
      instagram: ctx.ig,
      pages: ctx.pages,
      token: info ? { valid: info.valid, expiresAt: info.expiresAt, scopes: info.scopes, type: info.type } : null,
      // Page token derived from a user token, so the client can store the page token instead
      pageAccessToken: ctx.tokenKind === "user" ? ctx.pageToken : undefined,
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: explainGraphError(e) }, { status: 400 });
  }
}
