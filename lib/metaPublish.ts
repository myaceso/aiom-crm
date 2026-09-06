/** Server-side Meta Graph publish helpers (Facebook Page + Instagram Business). */

const GRAPH = "https://graph.facebook.com/v21.0";

export type ChannelResult = {
  id: string;
  ok: boolean;
  reason?: string;
  postId?: string;
  detail?: string;
};

export type PublishConnection = {
  id: string;
  connected?: boolean;
  handle?: string;
  profileUrl?: string;
  accessToken?: string;
  pageId?: string;
};

export type MediaFile = {
  blob: Blob;
  name: string;
  mime: string;
  kind: "image" | "video";
};

type GraphErr = { error?: { message?: string; code?: number; type?: string } };

async function graphGet<T>(
  path: string,
  token: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = (await res.json()) as T & GraphErr;
  if (!res.ok || (data as GraphErr).error) {
    throw new Error(
      (data as GraphErr).error?.message || `Graph GET failed (${res.status})`
    );
  }
  return data;
}

async function graphPostForm(
  path: string,
  token: string,
  fields: Record<string, string>,
  file?: { field: string; blob: Blob; filename: string }
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.set("access_token", token);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set(file.field, file.blob, file.filename);
  const res = await fetch(`${GRAPH}/${path.replace(/^\//, "")}`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const data = (await res.json()) as Record<string, unknown> & GraphErr;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Graph POST failed (${res.status})`);
  }
  return data;
}

async function resolveFacebookTarget(
  token: string,
  pageId?: string
): Promise<{ targetId: string; token: string }> {
  const pid = (pageId || "").trim();
  if (pid) return { targetId: pid, token };

  // Prefer a managed Page if the token can list them
  try {
    const accounts = await graphGet<{
      data?: Array<{ id: string; access_token?: string }>;
    }>("me/accounts", token, { fields: "id,access_token", limit: "1" });
    const page = accounts.data?.[0];
    if (page?.id) {
      return {
        targetId: page.id,
        token: page.access_token || token,
      };
    }
  } catch {
    // fall through to /me
  }
  return { targetId: "me", token };
}

async function resolveInstagramUserId(
  token: string,
  pageId?: string
): Promise<{ igUserId: string; pageToken: string }> {
  const raw = (pageId || "").trim();

  // If pageId looks like an IG business id (often starts with 1784...), try using directly
  // Prefer resolving via Page → instagram_business_account
  let pageToken = token;
  let fbPageId = raw;

  if (!fbPageId) {
    const accounts = await graphGet<{
      data?: Array<{ id: string; access_token?: string }>;
    }>("me/accounts", token, { fields: "id,access_token", limit: "5" });
    const page = accounts.data?.[0];
    if (!page?.id) {
      throw new Error(
        "Instagram requires a Facebook Page ID linked to an IG Business account. Add Page ID in Integrations."
      );
    }
    fbPageId = page.id;
    pageToken = page.access_token || token;
  } else {
    // If user stored a Page token separately we still use provided token;
    // try to upgrade via me/accounts when possible
    try {
      const accounts = await graphGet<{
        data?: Array<{ id: string; access_token?: string }>;
      }>("me/accounts", token, { fields: "id,access_token", limit: "25" });
      const match = accounts.data?.find((p) => p.id === fbPageId);
      if (match?.access_token) pageToken = match.access_token;
    } catch {
      /* keep token */
    }
  }

  // Try as Facebook Page first
  try {
    const page = await graphGet<{
      instagram_business_account?: { id: string };
    }>(fbPageId, pageToken, { fields: "instagram_business_account" });
    const ig = page.instagram_business_account?.id;
    if (ig) return { igUserId: ig, pageToken };
  } catch {
    /* maybe pageId is already an IG user id */
  }

  // Assume pageId itself is the IG business user id
  if (raw) {
    return { igUserId: raw, pageToken };
  }

  throw new Error(
    "Could not resolve Instagram Business account. Set Page ID (Facebook Page linked to IG) in Integrations."
  );
}

async function publishFacebook(
  conn: PublishConnection,
  message: string,
  media: MediaFile[]
): Promise<ChannelResult> {
  const token = (conn.accessToken || "").trim();
  if (!token) {
    return {
      id: "facebook",
      ok: false,
      reason: "needs_meta_token",
      detail:
        "Connect a Meta Access Token (Facebook/Instagram) to publish for real.",
    };
  }

  try {
    const { targetId, token: useToken } = await resolveFacebookTarget(
      token,
      conn.pageId
    );
    const images = media.filter((m) => m.kind === "image");
    const videos = media.filter((m) => m.kind === "video");

    if (images.length > 0) {
      const first = images[0];
      const data = await graphPostForm(
        `${targetId}/photos`,
        useToken,
        { caption: message || first.name, published: "true" },
        { field: "source", blob: first.blob, filename: first.name || "photo.jpg" }
      );
      return {
        id: "facebook",
        ok: true,
        postId: String(data.id || data.post_id || ""),
      };
    }

    if (videos.length > 0) {
      const first = videos[0];
      const data = await graphPostForm(
        `${targetId}/videos`,
        useToken,
        { description: message || first.name },
        { field: "source", blob: first.blob, filename: first.name || "video.mp4" }
      );
      return {
        id: "facebook",
        ok: true,
        postId: String(data.id || ""),
      };
    }

    const data = await graphPostForm(`${targetId}/feed`, useToken, {
      message: message || " ",
    });
    return {
      id: "facebook",
      ok: true,
      postId: String(data.id || ""),
    };
  } catch (e) {
    return {
      id: "facebook",
      ok: false,
      reason: "meta_api_error",
      detail: e instanceof Error ? e.message : "Facebook publish failed",
    };
  }
}

async function uploadPhotoGetUrl(
  pageId: string,
  token: string,
  file: MediaFile
): Promise<string> {
  const uploaded = await graphPostForm(
    `${pageId}/photos`,
    token,
    { published: "false", caption: file.name || "upload" },
    { field: "source", blob: file.blob, filename: file.name || "photo.jpg" }
  );
  const photoId = String(uploaded.id || "");
  if (!photoId) throw new Error("Facebook photo upload returned no id");
  const meta = await graphGet<{
    images?: Array<{ source?: string }>;
    source?: string;
  }>(photoId, token, { fields: "images,source" });
  const url =
    meta.images?.[0]?.source ||
    meta.source ||
    (meta.images || []).map((i) => i.source).find(Boolean);
  if (!url) {
    throw new Error(
      "Could not get a public image URL for Instagram. Upload a publicly reachable image or check Page permissions."
    );
  }
  return url;
}

async function publishInstagram(
  conn: PublishConnection,
  message: string,
  media: MediaFile[]
): Promise<ChannelResult> {
  const token = (conn.accessToken || "").trim();
  if (!token) {
    return {
      id: "instagram",
      ok: false,
      reason: "needs_meta_token",
      detail:
        "Connect a Meta Access Token (Facebook/Instagram) to publish for real.",
    };
  }

  const images = media.filter((m) => m.kind === "image");
  if (images.length === 0) {
    return {
      id: "instagram",
      ok: false,
      reason: "needs_image",
      detail:
        "Instagram feed publish requires an image. Attach an image or use Facebook for text-only.",
    };
  }

  try {
    const { igUserId, pageToken } = await resolveInstagramUserId(
      token,
      conn.pageId
    );

    // Resolve a Facebook Page id for staging the photo (unpublished)
    let stagingPageId = (conn.pageId || "").trim();
    if (!stagingPageId) {
      const accounts = await graphGet<{
        data?: Array<{ id: string; access_token?: string }>;
      }>("me/accounts", token, { fields: "id,access_token", limit: "1" });
      stagingPageId = accounts.data?.[0]?.id || "";
    }
    if (!stagingPageId) {
      return {
        id: "instagram",
        ok: false,
        reason: "needs_page_id",
        detail:
          "Instagram needs a Facebook Page ID linked to an IG Business account. Add Page ID in Integrations.",
      };
    }

    const imageUrl = await uploadPhotoGetUrl(
      stagingPageId,
      pageToken,
      images[0]
    );

    const container = await graphPostForm(`${igUserId}/media`, pageToken, {
      image_url: imageUrl,
      caption: message || "",
    });
    const creationId = String(container.id || "");
    if (!creationId) throw new Error("Instagram media container missing id");

    // Brief poll for FINISHED (max ~15s)
    for (let i = 0; i < 8; i++) {
      const status = await graphGet<{ status_code?: string }>(
        creationId,
        pageToken,
        { fields: "status_code" }
      );
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR") {
        throw new Error("Instagram media container processing failed");
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    const published = await graphPostForm(
      `${igUserId}/media_publish`,
      pageToken,
      { creation_id: creationId }
    );

    return {
      id: "instagram",
      ok: true,
      postId: String(published.id || ""),
    };
  } catch (e) {
    return {
      id: "instagram",
      ok: false,
      reason: "meta_api_error",
      detail: e instanceof Error ? e.message : "Instagram publish failed",
    };
  }
}

const OAUTH_NETWORKS = new Set([
  "linkedin",
  "x",
  "tiktok",
  "google_business",
]);

export async function publishToChannels(opts: {
  body: string;
  channels: string[];
  connections: PublishConnection[];
  media: MediaFile[];
}): Promise<{ results: ChannelResult[]; succeeded: string[]; failed: string[] }> {
  const byId = new Map(opts.connections.map((c) => [c.id, c]));
  const results: ChannelResult[] = [];

  for (const ch of opts.channels) {
    const conn = byId.get(ch);
    if (!conn?.connected) {
      results.push({
        id: ch,
        ok: false,
        reason: "not_connected",
        detail: "Network is not connected in Integrations.",
      });
      continue;
    }

    if (ch === "facebook") {
      results.push(await publishFacebook(conn, opts.body, opts.media));
      continue;
    }
    if (ch === "instagram") {
      results.push(await publishInstagram(conn, opts.body, opts.media));
      continue;
    }
    if (OAUTH_NETWORKS.has(ch)) {
      results.push({
        id: ch,
        ok: false,
        reason: "needs_oauth_app",
        detail: `${ch} requires a dedicated OAuth app — not available in this build.`,
      });
      continue;
    }
    results.push({
      id: ch,
      ok: false,
      reason: "unsupported",
      detail: `Unsupported channel: ${ch}`,
    });
  }

  const succeeded = results.filter((r) => r.ok).map((r) => r.id);
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  return { results, succeeded, failed };
}
