import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, disconnectBufferAccount } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser(["integrations"]);
  if (auth.error) return auth.error;
  try {
    await disconnectBufferAccount(auth.user.id);
    return NextResponse.json({ ok: true, message: "Buffer desconectado." });
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
