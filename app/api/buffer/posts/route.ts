import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, sendBufferPost } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireUser(["marketing", "integrations"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const result = await sendBufferPost(auth.user.id, body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
