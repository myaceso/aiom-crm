import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { getCurrentSafeUser } from "@/lib/session";
import { hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const issuer = "enone:creative";
const api = "https://api.dev.runwayml.com/v1";

function error(status: number, code: string) {
  return NextResponse.json({ error: code }, { status });
}

function credentials() {
  const token = process.env.RUNWAY_API_KEY;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  return {
    key: new TextEncoder().encode(`${secret}:enone:creative`),
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
  };
}

export async function POST(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user || !hasPermission(user, "marketing")) return error(403, "forbidden");
  const config = credentials();
  if (!config || !process.env.RUNWAY_CREATIVE_USERS?.split(",").some((id) => id.trim() === user.id)) {
    return error(503, "not_enabled");
  }

  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return error(415, "invalid_input");
  }
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const photo = body?.photo;
  if (!prompt || prompt.length > 800 || (kind !== "image" && kind !== "video")) {
    return error(400, "invalid_input");
  }
  if (
    kind === "video" &&
    (typeof photo !== "string" || photo.length > 2_000_000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))
  ) return error(400, "invalid_photo");

  const payload = kind === "image"
    ? { model: "gen4_image_turbo", ratio: "1080:1080",
        promptText: `${prompt}. Advertising photography, no lettering or watermarks.` }
    : { model: "gen4_turbo", ratio: "720:1280", duration: 5, promptText: prompt, promptImage: photo };

  try {
    const response = await fetch(`${api}/${kind === "image" ? "text_to_image" : "image_to_video"}`, {
      method: "POST", headers: config.headers, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return error(502, "provider_error");
    const { id } = await response.json();
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return error(502, "provider_error");
    const job = await new SignJWT({ id, kind }).setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer).setSubject(user.id).setExpirationTime("1h").sign(config.key);
    return NextResponse.json({ job });
  } catch {
    return error(502, "provider_error");
  }
}

export async function GET(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user || !hasPermission(user, "marketing")) return error(403, "forbidden");
  const config = credentials();
  if (!config) return error(503, "not_enabled");
  const job = new URL(req.url).searchParams.get("job");
  if (!job || job.length > 2048) return error(400, "invalid_job");

  const verified = await jwtVerify(job, config.key, {
    issuer, subject: user.id, algorithms: ["HS256"],
  }).catch(() => null);
  if (!verified) return error(403, "invalid_job");
  const { id, kind } = verified.payload;

  try {
    const response = await fetch(`${api}/tasks/${id}`, {
      headers: config.headers, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return error(502, "provider_error");
    const task = await response.json();
    if (task.status === "FAILED" || task.status === "CANCELED") return error(422, "generation_failed");
    if (task.status !== "SUCCEEDED") return NextResponse.json({ pending: true }, { status: 202 });

    const output = new URL(task.output[0]);
    if (output.protocol !== "https:" || output.username || output.password) {
      return error(502, "provider_error");
    }
    const media = await fetch(output, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(45_000) });
    const mime = media.headers.get("content-type")?.split(";")[0];
    if (!media.ok || !media.body || (kind === "video"
      ? mime !== "video/mp4"
      : !["image/jpeg", "image/png", "image/webp"].includes(mime || ""))) {
      return error(502, "provider_error");
    }
    return new Response(media.body, {
      headers: { "Content-Type": mime!, "Cache-Control": "private, no-store" },
    });
  } catch {
    return error(502, "provider_error");
  }
}
