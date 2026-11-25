import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, testBufferCredentials } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser(["integrations"]);
  if (auth.error) return auth.error;
  const body = (await req.json().catch(() => null)) as { apiKey?: string; useEnv?: boolean } | null;
  try {
    const snap = await testBufferCredentials({ apiKey: body?.apiKey, useEnv: Boolean(body?.useEnv) });
    return NextResponse.json({
      ok: true,
      message: `Conectado como ${snap.email || "tu cuenta de Buffer"}.`,
      accountId: snap.accountId,
      email: snap.email,
      organizations: snap.organizations,
    });
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
