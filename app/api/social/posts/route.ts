import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { listPosts, newPostId, savePost } from "@/lib/socialDb";
import { metaSetupFromCrm, processPost } from "@/lib/socialPublisher";
import { getCrmState } from "@/lib/crmDb";
import type { MetaChannel, ScheduledPost, ScheduledPostMedia } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IG_CAPTION_MAX = 2200;

export async function GET() {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const posts = await listPosts(auth.user.id);
  return NextResponse.json({ posts });
}

type Body = {
  body?: string;
  channels?: string[];
  media?: Partial<ScheduledPostMedia>[];
  scheduledAt?: string;
  publishNow?: boolean;
  lang?: string;
};

function isPublicUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  const payload = (await req.json().catch(() => null)) as Body | null;
  if (!payload) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const es = payload.lang !== "en";
  const msg = (a: string, b: string) => (es ? a : b);

  const text = String(payload.body || "").trim();
  const channels = Array.from(
    new Set((payload.channels || []).filter((c): c is MetaChannel => c === "facebook" || c === "instagram"))
  );
  const media: ScheduledPostMedia[] = (payload.media || [])
    .filter((m) => m && typeof m.url === "string" && isPublicUrl(m.url))
    .slice(0, 10)
    .map((m) => ({
      url: String(m.url),
      kind: m.kind === "video" ? "video" : "image",
      mime: String(m.mime || ""),
      name: String(m.name || "media"),
      assetId: m.assetId ? String(m.assetId) : undefined,
    }));

  if (channels.length === 0)
    return NextResponse.json({ error: msg("Elige Facebook, Instagram o ambos", "Choose Facebook, Instagram or both") }, { status: 400 });
  if ((payload.media || []).length !== media.length)
    return NextResponse.json(
      { error: msg("Hay medios sin subir a la nube. Vuelve a adjuntarlos.", "Some media is not uploaded to the cloud. Re-attach it.") },
      { status: 400 }
    );
  if (!text && media.length === 0)
    return NextResponse.json({ error: msg("Escribe un mensaje o adjunta medios", "Write a post or attach media") }, { status: 400 });
  if (channels.includes("instagram") && media.length === 0)
    return NextResponse.json(
      { error: msg("Instagram requiere al menos una imagen o un video", "Instagram requires at least one image or video") },
      { status: 400 }
    );
  if (channels.includes("instagram") && text.length > IG_CAPTION_MAX)
    return NextResponse.json(
      { error: msg(`El texto supera ${IG_CAPTION_MAX} caracteres (límite de Instagram)`, `Caption exceeds ${IG_CAPTION_MAX} characters (Instagram limit)`) },
      { status: 400 }
    );

  const { creds, connected } = metaSetupFromCrm(await getCrmState(auth.user.id));
  const notConnected = channels.filter((c) => !connected[c]);
  if (notConnected.length || !creds.accessToken)
    return NextResponse.json(
      {
        error: msg(
          "Conecta Facebook/Instagram (ID de Página + Access Token) en Integraciones antes de publicar",
          "Connect Facebook/Instagram (Page ID + Access Token) in Integrations first"
        ),
        missing: notConnected,
      },
      { status: 400 }
    );

  const now = new Date();
  let when = now;
  if (!payload.publishNow) {
    const d = new Date(String(payload.scheduledAt || ""));
    if (Number.isNaN(+d))
      return NextResponse.json({ error: msg("Elige fecha y hora", "Pick a date and time") }, { status: 400 });
    if (+d < +now - 2 * 60_000)
      return NextResponse.json({ error: msg("La fecha programada ya pasó", "Scheduled time is in the past") }, { status: 400 });
    when = d;
  }

  const post: ScheduledPost = {
    id: newPostId(),
    userId: auth.user.id,
    body: text,
    channels,
    media,
    status: "scheduled",
    scheduledAt: when.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    publishedAt: null,
    attempts: 0,
    nextAttemptAt: null,
    lockedAt: null,
    lastError: null,
    results: {},
  };
  await savePost(post);

  if (payload.publishNow) {
    const result = await processPost(auth.user.id, post.id, {
      deadline: Date.now() + 90_000,
      autoRetryHardErrors: false,
    });
    return NextResponse.json({ post: result || post });
  }
  return NextResponse.json({ post });
}
