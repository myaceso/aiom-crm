import { getAsset } from "@/lib/creative/records";
import { readLocalMedia } from "@/lib/creative/storage";
import { requireUser } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["marketing"]);
  if (auth.error) return auth.error;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
  const asset = await getAsset(auth.user.id, params.id);
  if (!asset || !asset.pathname.startsWith("local/")) return new Response("Not found", { status: 404 });
  const bytes = await readLocalMedia(auth.user.id, asset.id, asset.mime).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });

  const common = {
    "Content-Type": asset.mime,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const range = req.headers.get("range");
  const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
  if (match) {
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (start > end || start >= bytes.length) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
    }
    const slice = bytes.subarray(start, end + 1);
    return new Response(new Uint8Array(slice), {
      status: 206,
      headers: {
        ...common,
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        "Content-Length": String(slice.length),
      },
    });
  }
  return new Response(new Uint8Array(bytes), {
    headers: { ...common, "Content-Length": String(bytes.length) },
  });
}
