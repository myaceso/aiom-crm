import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, getBufferSchedule, saveBufferSchedule } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["marketing", "integrations"]);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getBufferSchedule(auth.user.id));
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUser(["marketing", "integrations"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    return NextResponse.json(await saveBufferSchedule(auth.user.id, body));
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
