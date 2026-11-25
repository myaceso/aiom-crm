import { NextResponse } from "next/server";
import { runDueBuffer } from "@/lib/buffer/service";
import { runDuePosts } from "@/lib/socialPublisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publishes due Facebook/Instagram posts and Buffer daily slots for every account.
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 * An external cron can call it the same way (header) as a fallback.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  const header = req.headers.get("authorization") || "";
  if (header !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  try {
    const summary = await runDuePosts(started + 200_000);
    const buffer = await runDueBuffer(started + 270_000);
    return NextResponse.json({ ok: true, ...summary, buffer, ms: Date.now() - started, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/publish]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "cron_failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
