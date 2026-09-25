/**
 * Server-side Meta Graph API helpers: Facebook Page + Instagram professional account publishing.
 * All media is referenced by PUBLIC URL (Vercel Blob) — Meta downloads it from there.
 */
import type { ScheduledPostChannelResult, ScheduledPostMedia } from "./types";

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  transient: boolean;
  constructor(message: string, code?: number, subcode?: number, transient = false) {
    super(message);
    this.code = code;
    this.subcode = subcode;
    this.transient = transient;
  }
}

type GraphErrBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
    error_user_msg?: string;
    error_user_title?: string;
  };
};

const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);

function toGraphError(data: GraphErrBody, status: number): GraphError {
  const e = data.error || {};
  const msg = e.error_user_msg || e.message || `Graph API error (HTTP ${status})`;
  return new GraphError(
    msg,
    e.code,
    e.error_subcode,
    Boolean(e.is_transient) || (e.code != null && TRANSIENT_CODES.has(e.code)) || status >= 500
  );
}

export async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & GraphErrBody;
  if (!res.ok || (data as GraphErrBody).error) throw toGraphError(data as GraphErrBody, res.status);
  return data;
}

export async function graphPost<T = Record<string, unknown>>(
  path: string,
  token: string,
  fields: Record<string, string>
): Promise<T> {
  const body = new URLSearchParams(fields);
  body.set("access_token", token);
  const res = await fetch(`${GRAPH}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & GraphErrBody;
  if (!res.ok || (data as GraphErrBody).error) throw toGraphError(data as GraphErrBody, res.status);
  return data;
}

/** Human (Spanish-first) hint for common Graph errors. */
export function explainGraphError(e: unknown): string {
  if (!(e instanceof Error)) return "Error desconocido de Meta";
  const g = e as GraphError;
  let hint = "";
  if (g.code === 190) hint = "Token de Meta inválido o vencido. Genera uno nuevo (token de Página de larga duración) en Integraciones.";
  else if (g.code === 10 || g.code === 200 || (g.code != null && g.code >= 200 && g.code < 300))
    hint = "Faltan permisos: pages_manage_posts, pages_read_engagement, pages_show_list, instagram_basic, instagram_content_publish.";
  else if (g.code === 100 && /instagram|ig user/i.test(g.message))
    hint = "Revisa el ID de la cuenta de Instagram (debe ser Business/Creator vinculada a la Página).";
  else if (g.code === 9004 || g.subcode === 2207052 || g.subcode === 2207026)
    hint = "Meta no pudo descargar o procesar el archivo. Usa JPG para imágenes y MP4 (H.264/AAC) para videos.";
  else if (g.code === 36003 || g.subcode === 2207009) hint = "Relación de aspecto no válida para Instagram (usa entre 4:5 y 1.91:1; Reels 9:16).";
  else if (g.code === 4 || g.code === 17 || g.code === 32 || g.code === 613) hint = "Límite de uso de la API alcanzado; se reintentará.";
  return hint ? `${g.message} — ${hint}` : g.message;
}

export type MetaCredentials = {
  accessToken: string;
  pageId?: string;
  igUserId?: string;
};

export type PageContext = {
  pageId: string;
  pageName?: string;
  pageToken: string;
  tokenKind: "page" | "user";
  ig: { id: string; username?: string } | null;
  pages?: { id: string; name?: string }[];
  warnings: string[];
};

type AccountsResp = {
  data?: Array<{
    id: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id: string; username?: string };
  }>;
};

/** Resolve the Page + Page token + linked Instagram account from whatever token/ids the user saved. */
export async function resolvePageContext(creds: MetaCredentials): Promise<PageContext> {
  const token = (creds.accessToken || "").trim();
  if (!token) throw new GraphError("Falta el Access Token de Meta. Guárdalo en Integraciones.");
  const warnings: string[] = [];
  const wantedPage = (creds.pageId || "").trim();

  const me = await graphGet<{ id: string; name?: string }>("me", token, { fields: "id,name" });

  let pageId = "";
  let pageName: string | undefined;
  let pageToken = token;
  let tokenKind: "page" | "user" = "page";
  let pages: { id: string; name?: string }[] | undefined;

  if (wantedPage && me.id === wantedPage) {
    pageId = me.id;
    pageName = me.name;
  } else {
    // Is it a user token? (page tokens can't list /me/accounts)
    let accounts: AccountsResp | null = null;
    try {
      accounts = await graphGet<AccountsResp>("me/accounts", token, {
        fields: "id,name,access_token",
        limit: "100",
      });
    } catch {
      accounts = null;
    }
    if (accounts) {
      tokenKind = "user";
      pages = (accounts.data || []).map((p) => ({ id: p.id, name: p.name }));
      const match = wantedPage ? accounts.data?.find((p) => p.id === wantedPage) : accounts.data?.[0];
      if (match?.access_token) {
        pageId = match.id;
        pageName = match.name;
        pageToken = match.access_token;
        if (!wantedPage && (accounts.data?.length || 0) > 1)
          warnings.push("El token administra varias Páginas; se usó la primera. Indica el ID de Página para elegir otra.");
      } else if (wantedPage) {
        // Try direct field (works if user has a role on the Page)
        try {
          const p = await graphGet<{ id: string; name?: string; access_token?: string }>(wantedPage, token, {
            fields: "id,name,access_token",
          });
          if (p.access_token) {
            pageId = p.id;
            pageName = p.name;
            pageToken = p.access_token;
          }
        } catch {
          /* handled below */
        }
        if (!pageId)
          throw new GraphError(
            `Este token no administra la Página ${wantedPage}. Usa un token de la Página o un token de usuario con acceso a ella (pages_show_list).`
          );
      } else {
        throw new GraphError("El token no tiene Páginas de Facebook (pages_show_list). Indica el ID de Página y usa un token de Página.");
      }
      warnings.push(
        "Estás usando un token de USUARIO (caduca). Recomendado: guarda el token de PÁGINA de larga duración (botón «Convertir a token permanente» o Access Token Debugger → Extender)."
      );
    } else {
      // Page token for a different page than the one requested, or page token without pageId
      if (wantedPage && me.id !== wantedPage)
        throw new GraphError(`El token pertenece a «${me.name || me.id}» (ID ${me.id}), no a la Página ${wantedPage}.`);
      pageId = me.id;
      pageName = me.name;
    }
  }

  let ig: PageContext["ig"] = null;
  try {
    const p = await graphGet<{ instagram_business_account?: { id: string; username?: string } }>(pageId, pageToken, {
      fields: "instagram_business_account{id,username}",
    });
    if (p.instagram_business_account?.id) ig = p.instagram_business_account;
  } catch (e) {
    warnings.push(`No se pudo leer la cuenta de Instagram vinculada: ${e instanceof Error ? e.message : e}`);
  }
  const override = (creds.igUserId || "").trim();
  if (override && override !== ig?.id) {
    let username: string | undefined;
    try {
      const u = await graphGet<{ username?: string }>(override, pageToken, { fields: "username" });
      username = u.username;
    } catch (e) {
      warnings.push(`El ID de Instagram ${override} no es accesible con este token: ${e instanceof Error ? e.message : e}`);
    }
    ig = { id: override, username };
  }
  if (!ig) warnings.push("No hay cuenta de Instagram Business/Creator vinculada a esta Página.");

  return { pageId, pageName, pageToken, tokenKind, ig, pages, warnings };
}

export type TokenInfo = { valid?: boolean; expiresAt?: string | null; scopes?: string[]; type?: string };

export async function debugToken(token: string): Promise<TokenInfo | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const inspector = appId && appSecret ? `${appId}|${appSecret}` : token;
  try {
    const d = await graphGet<{
      data?: { is_valid?: boolean; expires_at?: number; scopes?: string[]; type?: string };
    }>("debug_token", inspector, { input_token: token });
    const x = d.data || {};
    return {
      valid: x.is_valid,
      expiresAt: x.expires_at ? new Date(x.expires_at * 1000).toISOString() : null,
      scopes: x.scopes,
      type: x.type,
    };
  } catch {
    return null;
  }
}

export const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
];

/** Exchange a short-lived USER token for a long-lived one and list Pages with their (non-expiring) Page tokens. */
export async function exchangeForPageTokens(userToken: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new GraphError("META_APP_ID / META_APP_SECRET no están configurados en el servidor.");
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", userToken.trim());
  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number } & GraphErrBody;
  if (!res.ok || data.error || !data.access_token) throw toGraphError(data, res.status);
  const longUser = data.access_token;
  const accounts = await graphGet<AccountsResp>("me/accounts", longUser, {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  return {
    userTokenExpiresIn: data.expires_in ?? null,
    pages: (accounts.data || []).map((p) => ({
      id: p.id,
      name: p.name || p.id,
      accessToken: p.access_token || "",
      instagram: p.instagram_business_account || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export type PublishOutcome = ScheduledPostChannelResult & { pending?: boolean; transient?: boolean };

function firstUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s)]+/i);
  return m?.[0];
}

async function fbPermalink(id: string, token: string): Promise<string | undefined> {
  try {
    const r = await graphGet<{ permalink_url?: string }>(id, token, { fields: "permalink_url" });
    return r.permalink_url;
  } catch {
    return undefined;
  }
}

export async function publishFacebook(
  ctx: PageContext,
  message: string,
  media: ScheduledPostMedia[]
): Promise<PublishOutcome> {
  const at = new Date().toISOString();
  try {
    const videos = media.filter((m) => m.kind === "video");
    const images = media.filter((m) => m.kind === "image").slice(0, 10);

    if (videos.length > 0) {
      const v = await graphPost<{ id?: string }>(`${ctx.pageId}/videos`, ctx.pageToken, {
        file_url: videos[0].url,
        description: message,
      });
      const id = String(v.id || "");
      return { ok: true, id, permalink: id ? `https://www.facebook.com/${ctx.pageId}/videos/${id}` : undefined, at };
    }

    if (images.length === 1) {
      const r = await graphPost<{ id?: string; post_id?: string }>(`${ctx.pageId}/photos`, ctx.pageToken, {
        url: images[0].url,
        message,
        published: "true",
      });
      const id = String(r.post_id || r.id || "");
      return { ok: true, id, permalink: await fbPermalink(id, ctx.pageToken), at };
    }

    if (images.length > 1) {
      const fields: Record<string, string> = { message };
      for (let i = 0; i < images.length; i++) {
        const up = await graphPost<{ id?: string }>(`${ctx.pageId}/photos`, ctx.pageToken, {
          url: images[i].url,
          published: "false",
        });
        fields[`attached_media[${i}]`] = JSON.stringify({ media_fbid: String(up.id) });
      }
      const r = await graphPost<{ id?: string }>(`${ctx.pageId}/feed`, ctx.pageToken, fields);
      const id = String(r.id || "");
      return { ok: true, id, permalink: await fbPermalink(id, ctx.pageToken), at };
    }

    if (!message.trim()) return { ok: false, error: "Publicación vacía: escribe texto o adjunta medios.", at };
    const fields: Record<string, string> = { message };
    const link = firstUrl(message);
    if (link) fields.link = link;
    const r = await graphPost<{ id?: string }>(`${ctx.pageId}/feed`, ctx.pageToken, fields);
    const id = String(r.id || "");
    return { ok: true, id, permalink: await fbPermalink(id, ctx.pageToken), at };
  } catch (e) {
    return { ok: false, error: explainGraphError(e), transient: e instanceof GraphError && e.transient, at };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll container status. Returns "FINISHED" | "PENDING" (deadline reached). Throws on ERROR/EXPIRED. */
async function waitContainer(id: string, token: string, deadline: number): Promise<"FINISHED" | "PENDING"> {
  for (;;) {
    const s = await graphGet<{ status_code?: string; status?: string }>(id, token, { fields: "status_code,status" });
    if (s.status_code === "FINISHED" || s.status_code === "PUBLISHED") return "FINISHED";
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new GraphError(`Instagram no pudo procesar el archivo (${s.status_code}${s.status ? `: ${s.status}` : ""}).`);
    if (Date.now() + 4000 > deadline) return "PENDING";
    await sleep(3000);
  }
}

export async function publishInstagram(
  ctx: PageContext,
  caption: string,
  media: ScheduledPostMedia[],
  opts: { deadline: number; resumeContainerId?: string }
): Promise<PublishOutcome> {
  const at = new Date().toISOString();
  if (!ctx.ig?.id)
    return {
      ok: false,
      error: "No hay cuenta de Instagram Business/Creator vinculada a la Página. Vincúlala en Meta y pulsa «Probar conexión».",
      at,
    };
  const ig = ctx.ig.id;
  const token = ctx.pageToken;
  const items = media.slice(0, 10);
  if (items.length === 0)
    return { ok: false, error: "Instagram requiere al menos una imagen o un video.", at };

  let containerId = opts.resumeContainerId || "";
  try {
    if (!containerId) {
      if (items.length === 1) {
        const m = items[0];
        const fields: Record<string, string> =
          m.kind === "video"
            ? { media_type: "REELS", video_url: m.url, caption, share_to_feed: "true" }
            : { image_url: m.url, caption };
        const c = await graphPost<{ id?: string }>(`${ig}/media`, token, fields);
        containerId = String(c.id || "");
      } else {
        const children: string[] = [];
        for (const m of items) {
          const fields: Record<string, string> =
            m.kind === "video"
              ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" }
              : { image_url: m.url, is_carousel_item: "true" };
          const c = await graphPost<{ id?: string }>(`${ig}/media`, token, fields);
          children.push(String(c.id));
        }
        for (const child of children) {
          const st = await waitContainer(child, token, opts.deadline);
          if (st === "PENDING") {
            return {
              ok: false,
              transient: true,
              error: "Instagram sigue procesando los elementos del carrusel; se reintentará.",
              at,
            };
          }
        }
        const parent = await graphPost<{ id?: string }>(`${ig}/media`, token, {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption,
        });
        containerId = String(parent.id || "");
      }
      if (!containerId) throw new GraphError("Instagram no devolvió ID de contenedor.");
    }

    const st = await waitContainer(containerId, token, opts.deadline);
    if (st === "PENDING")
      return { ok: false, pending: true, containerId, error: "Instagram está procesando el video; se publicará en la próxima ejecución.", at };

    const pub = await graphPost<{ id?: string }>(`${ig}/media_publish`, token, { creation_id: containerId });
    const id = String(pub.id || "");
    let permalink: string | undefined;
    try {
      permalink = (await graphGet<{ permalink?: string }>(id, token, { fields: "permalink" })).permalink;
    } catch {
      /* optional */
    }
    return { ok: true, id, permalink, at };
  } catch (e) {
    return {
      ok: false,
      error: explainGraphError(e),
      transient: e instanceof GraphError && e.transient,
      at,
    };
  }
}
