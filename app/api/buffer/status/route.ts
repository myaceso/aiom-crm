import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, bufferStatus } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["marketing", "integrations"]);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await bufferStatus(auth.user.id));
  } catch (e) {
    const body = bufferErrorBody(e);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
