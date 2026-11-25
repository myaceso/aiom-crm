import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { ProviderError, testFalKey } from "@/lib/creative/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function message(es: string, en: string, lang: unknown) {
  return lang === "en" ? en : es;
}

export async function POST(req: Request) {
  const auth = await requireUser(["integrations", "marketing"]);
  if (auth.error) return auth.error;
  const body = (await req.json().catch(() => null)) as { provider?: string; apiKey?: string; lang?: string } | null;
  const provider = body?.provider === "fal" ? "fal" : body?.provider === "openai" ? "openai" : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!provider || !apiKey || apiKey.length > 400) {
    return NextResponse.json(
      { error: message("Escribe la clave que quieres probar.", "Enter the key you want to test.", body?.lang) },
      { status: 400 }
    );
  }
  try {
    if (provider === "openai") {
      const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: message("OpenAI rechazó la clave.", "OpenAI rejected the key.", body?.lang) },
          { status: 422 }
        );
      }
      if (!response.ok) {
        return NextResponse.json(
          { error: message("No se pudo contactar a OpenAI.", "Could not reach OpenAI.", body?.lang) },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: message("Clave de OpenAI válida.", "OpenAI key looks valid.", body?.lang),
      });
    }
    await testFalKey(apiKey);
    return NextResponse.json({
      ok: true,
      message: message("Clave de fal.ai válida.", "fal.ai key looks valid.", body?.lang),
    });
  } catch (error) {
    const authFailed = error instanceof ProviderError && error.code === "auth";
    return NextResponse.json(
      {
        error: message(
          authFailed ? "fal.ai rechazó la clave." : "No se pudo contactar a fal.ai.",
          authFailed ? "fal.ai rejected the key." : "Could not reach fal.ai.",
          body?.lang
        ),
      },
      { status: authFailed ? 422 : 502 }
    );
  }
}
