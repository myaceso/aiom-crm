import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { bufferErrorBody, connectBufferAccount } from "@/lib/buffer/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser(["integrations"]);
  if (auth.error) return auth.error;
  const body = (await req.json().catch(() => null)) as {
    apiKey?: string;
    useEnv?: boolean;
    refresh?: boolean;
    organizationId?: string;
    channelIds?: string[];
  } | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const result = await connectBufferAccount(auth.user.id, body);
    return NextResponse.json({
      ok: true,
      message: "Buffer conectado.",
      integration: { ...result.integration, apiKey: result.integration.apiKey ? "saved" : "" },
      organizations: result.organizations,
    });
  } catch (e) {
    const err = bufferErrorBody(e);
    return NextResponse.json({ error: err.error }, { status: err.status });
  }
}
