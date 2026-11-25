import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getCurrentSafeUser } from "@/lib/session";
import {
  defaultLandingTemplate,
  sanitizeLandingTemplate,
} from "@/lib/landing/template";
import { getLandingRecord, saveLandingRecord } from "@/lib/landing/templateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const editor = url.searchParams.get("editor") === "1";
  if (!editor) {
    const record = await getLandingRecord().catch(() => ({ draft: null, published: null }));
    return NextResponse.json({ published: record.published });
  }
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const record = await getLandingRecord();
  return NextResponse.json({
    draft: record.draft,
    published: record.published,
    defaults: defaultLandingTemplate(),
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: string }).action : "";
  if (action === "restore") {
    await saveLandingRecord({ draft: null, published: null });
    return NextResponse.json({ ok: true, template: defaultLandingTemplate() });
  }
  if (action !== "save" && action !== "publish") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const template = sanitizeLandingTemplate(
    body && typeof body === "object" ? (body as { template?: unknown }).template : null
  );
  const current = await getLandingRecord();
  const next = {
    draft: template,
    published: action === "publish" ? template : current.published,
  };
  await saveLandingRecord(next);
  return NextResponse.json({ ok: true, template });
}
