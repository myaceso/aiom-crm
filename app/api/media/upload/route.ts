import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentSafeUser } from "@/lib/session";
import { hasPermission } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

/** Issues client-upload tokens for Vercel Blob (public URLs that Facebook/Instagram can download). */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN no configurado" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentSafeUser();
        if (!user || !hasPermission(user, "marketing")) throw new Error("unauthorized");
        if (!pathname.startsWith(`social/${user.id}/`)) throw new Error("invalid_path");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const m = e instanceof Error ? e.message : "upload_failed";
    return NextResponse.json({ error: m }, { status: m === "unauthorized" ? 401 : 400 });
  }
}
