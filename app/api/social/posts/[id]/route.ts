import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { deletePost, getPost, savePost } from "@/lib/socialDb";
import { processPost } from "@/lib/socialPublisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

/** PATCH { action: "retry" | "cancel" | "reschedule", scheduledAt? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const post = await getPost(auth.user.id, params.id);
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; scheduledAt?: string };

  if (body.action === "cancel") {
    if (post.status === "published") return NextResponse.json({ error: "Ya publicado" }, { status: 400 });
    if (post.status === "publishing") return NextResponse.json({ error: "Se está publicando ahora mismo" }, { status: 409 });
    post.status = "cancelled";
    post.nextAttemptAt = null;
    await savePost(post);
    return NextResponse.json({ post });
  }

  if (body.action === "reschedule") {
    const d = new Date(String(body.scheduledAt || ""));
    if (Number.isNaN(+d) || +d < Date.now() - 2 * 60_000)
      return NextResponse.json({ error: "Fecha no válida o en el pasado" }, { status: 400 });
    if (post.status === "published" || post.status === "publishing")
      return NextResponse.json({ error: "No se puede reprogramar" }, { status: 400 });
    post.scheduledAt = d.toISOString();
    post.status = "scheduled";
    post.attempts = 0;
    post.nextAttemptAt = null;
    post.lastError = null;
    await savePost(post);
    return NextResponse.json({ post });
  }

  if (body.action === "retry") {
    if (post.status === "published") return NextResponse.json({ error: "Ya publicado" }, { status: 400 });
    if (post.status === "publishing") return NextResponse.json({ error: "Se está publicando ahora mismo" }, { status: 409 });
    post.status = "scheduled";
    post.attempts = 0;
    post.nextAttemptAt = null;
    post.lastError = null;
    await savePost(post);
    const result = await processPost(auth.user.id, post.id, {
      deadline: Date.now() + 90_000,
      autoRetryHardErrors: false,
    });
    return NextResponse.json({ post: result || post });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

/** Removes the post from enone's list (does NOT delete it from Facebook/Instagram). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const post = await getPost(auth.user.id, params.id);
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.status === "publishing") return NextResponse.json({ error: "Se está publicando ahora mismo" }, { status: 409 });
  await deletePost(auth.user.id, params.id);
  return NextResponse.json({ ok: true });
}
