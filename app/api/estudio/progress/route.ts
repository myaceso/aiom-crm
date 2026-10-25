import { NextRequest, NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { getJson, setJson } from "@/lib/kvStore";

export const dynamic = "force-dynamic";

type Stat = { c: number; t: number };
type Progress = { byQuestion: Record<string, Stat>; exams: { at: string; score: number; total: number; byTopic: Record<string, Stat> }[] };

const key = (id: string) => `estudio:ga-life:${id}`;

function clean(input: unknown): Progress | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Partial<Progress>;
  const byQuestion: Record<string, Stat> = {};
  for (const [k, v] of Object.entries(o.byQuestion ?? {})) {
    if (k.length < 10 && v && typeof v.c === "number" && typeof v.t === "number") byQuestion[k] = { c: v.c, t: v.t };
  }
  const exams = Array.isArray(o.exams) ? o.exams.slice(-20) : [];
  return { byQuestion, exams };
}

export async function GET() {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getJson<Progress>(key(user.id));
  return NextResponse.json({ progress: data ?? { byQuestion: {}, exams: [] } });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { progress?: unknown } | null;
  const p = clean(body?.progress);
  if (!p) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await setJson(key(user.id), p);
  return NextResponse.json({ ok: true });
}
