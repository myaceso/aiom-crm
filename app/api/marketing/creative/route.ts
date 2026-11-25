import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { resolveCreativeKeys } from "@/lib/creative/keys";
import {
  CreativeRequestError,
  configOf,
  deleteGalleryItem,
  editCreativeImage,
  galleryFor,
  parseGenerateBody,
  readGeneration,
  refreshCreativeCopy,
  saveCreativeCopy,
  startGeneration,
} from "@/lib/creative/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(status: number, error: string, es: string, en: string) {
  return NextResponse.json({ error, message: es, messageEn: en }, { status });
}

function fromError(error: unknown) {
  if (error instanceof CreativeRequestError) {
    return fail(error.status, error.code, error.copy.es, error.copy.en);
  }
  return fail(502, "provider_error", "No se pudo completar la generación.", "Could not finish generation.");
}

export async function GET(req: Request) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const keys = await resolveCreativeKeys(auth.user.id);
  const url = new URL(req.url);
  const job = url.searchParams.get("job");
  if (job) {
    try {
      const view = await readGeneration(auth.user.id, job, keys);
      if (view.status === "pending") {
        return NextResponse.json(
          { status: "pending", phase: view.phase, queuePosition: view.queuePosition ?? null },
          { status: 202 }
        );
      }
      if (view.status === "failed") return fail(422, "generation_failed", view.copy.es, view.copy.en);
      return NextResponse.json({ status: "succeeded", asset: view.asset });
    } catch (error) {
      return fromError(error);
    }
  }
  try {
    const gallery = await galleryFor(auth.user.id);
    return NextResponse.json({ gallery, config: configOf(keys) });
  } catch {
    return fail(502, "gallery_failed", "No se pudo cargar la galería.", "Could not load the gallery.");
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "invalid_input", "Envía la solicitud en JSON.", "Send the request as JSON.");
  }
  const body = await req.json().catch(() => null);
  const keys = await resolveCreativeKeys(auth.user.id);
  const lang = body && typeof body === "object" && (body as { lang?: string }).lang === "en" ? "en" : "es";
  try {
    if (body && typeof body === "object" && (body as { action?: string }).action === "copy") {
      const id = String((body as { id?: string }).id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return fail(400, "invalid_input", "Falta la creación.", "The creation is missing.");
      }
      const refreshed = await refreshCreativeCopy(auth.user.id, id, keys, lang);
      return NextResponse.json(refreshed);
    }
    if (body && typeof body === "object" && (body as { action?: string }).action === "edit") {
      const id = String((body as { id?: string }).id || "");
      const instruction = String((body as { instruction?: string }).instruction || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return fail(400, "invalid_input", "Falta la creación.", "The creation is missing.");
      }
      const edited = await editCreativeImage(auth.user.id, id, instruction, lang, keys);
      return NextResponse.json(edited);
    }
    const input = parseGenerateBody(body);
    const result = await startGeneration(auth.user.id, input, keys);
    return NextResponse.json(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return fail(400, "invalid_input", "Falta la creación.", "The creation is missing.");
  }
  const caption = typeof body?.caption === "string" ? body.caption : "";
  const hashtags = Array.isArray(body?.hashtags) ? body.hashtags.join(" ") : typeof body?.hashtags === "string" ? body.hashtags : "";
  try {
    const asset = await saveCreativeCopy(auth.user.id, id, caption, hashtags);
    return NextResponse.json({ asset });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return fail(400, "invalid_input", "Falta el id de la creación.", "The creation id is missing.");
  }
  const removed = await deleteGalleryItem(auth.user.id, id);
  if (!removed) return fail(404, "not_found", "Esa creación ya no está.", "That creation is no longer there.");
  return NextResponse.json({ ok: true });
}
