import { NextResponse } from "next/server";
import { appendLandingLead } from "@/lib/landing/persist";
import { buildLandingContact, validateLandingLead } from "@/lib/landing/lead";
import { defaultLandingTemplate, serviceChoices } from "@/lib/landing/template";
import { getPublishedLanding } from "@/lib/landing/templateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 8;
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
}

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(req: Request) {
  if (limited(clientIp(req))) {
    return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const published = await getPublishedLanding().catch(() => null);
  const choices = serviceChoices(published ?? defaultLandingTemplate());
  const parsed = validateLandingLead(body, choices.map((item) => item.id));
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  if (parsed.spam) {
    return NextResponse.json({ ok: true });
  }

  try {
    const labels = Object.fromEntries(choices.map((item) => [item.id, item.title]));
    const contact = buildLandingContact(parsed.lead, new Date(), undefined, labels);
    const saved = await appendLandingLead(contact);
    if (!saved.ok) {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
