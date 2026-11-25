import { generateAiReply, isAiConfigured } from "../ai";
import { listAssets } from "../creative/records";
import { getCrmState, saveCrmState } from "../crmDb";
import { normalizeIntegrations } from "../seed";
import type { BufferChannelInfo, CrmState } from "../types";
import { BufferApiError, appBufferClient, type BufferAccountSnapshot, type BufferClient } from "./client";
import { deliverToChannels, runDailyPass, type CaptionResult } from "./daily";
import { BUFFER_MSG } from "./messages";
import {
  blankBufferIntegration,
  bufferFromCrm,
  cleanChannels,
  integrationFromAuth,
  isBufferId,
  isHttpsUrl,
  normalizeTimes,
  safeTimeZone,
  type BufferAuthRecord,
  type BufferConfig,
  type BufferMedia,
  type BufferPostMode,
} from "./model";
import { oauthConfigured, refreshAccessToken } from "./oauth";
import { getBufferConfig, listDailyUserIds, saveBufferConfig, withBufferLock } from "./persist";
import { studioGalleryAssets } from "./schedule";

export function bufferEnvKey(): string {
  return process.env.BUFFER_API_KEY?.trim() || "";
}

export function bufferErrorBody(e: unknown): { status: number; error: string } {
  if (e instanceof BufferApiError) {
    const status = e.code === "unauthorized" ? 401 : e.code === "rate_limit" ? 429 : e.code === "network" ? 502 : 400;
    return { status, error: e.message };
  }
  if (e instanceof Error && e.message) return { status: 400, error: e.message };
  return { status: 500, error: "No se pudo completar la operación con Buffer." };
}

export async function resolveBufferToken(cfg: BufferConfig, crmKey: string): Promise<string> {
  const auth = cfg.auth;
  if (auth?.method === "oauth") {
    const exp = auth.accessTokenExpiresAt ? +new Date(auth.accessTokenExpiresAt) : 0;
    if (auth.accessToken && exp > Date.now() + 30_000) return auth.accessToken;
    if (!auth.refreshToken) throw new BufferApiError(BUFFER_MSG.reconnect, 401, "unauthorized");
    try {
      const pair = await refreshAccessToken(auth.refreshToken);
      auth.accessToken = pair.accessToken;
      if (pair.refreshToken) auth.refreshToken = pair.refreshToken;
      auth.accessTokenExpiresAt = pair.expiresAt;
      return pair.accessToken;
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : BUFFER_MSG.reconnect;
      throw new BufferApiError(message, 401, "unauthorized");
    }
  }
  if (auth?.method === "api_key" && auth.apiKey.trim()) return auth.apiKey.trim();
  if (auth?.method === "env") {
    const key = bufferEnvKey();
    if (!key) throw new BufferApiError(BUFFER_MSG.envMissing, 0, "missing");
    return key;
  }
  if (crmKey.trim()) return crmKey.trim();
  throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
}

function pickOrg(snap: BufferAccountSnapshot, preferred?: string) {
  if (!snap.organizations.length) return null;
  const id = preferred && isBufferId(preferred) ? preferred.toLowerCase() : "";
  return snap.organizations.find((o) => o.id === id) || snap.organizations[0];
}

async function writeCrm(userId: string, crm: CrmState | null, auth: BufferAuthRecord | null) {
  if (!crm) return;
  const integrations = normalizeIntegrations(crm.integrations);
  integrations.buffer = auth ? integrationFromAuth(auth) : blankBufferIntegration();
  await saveCrmState(userId, { ...crm, integrations });
}

function clientFor(token: string): Pick<BufferClient, "createPost"> {
  let pending: Promise<BufferClient> | null = null;
  return {
    createPost: (input) => {
      pending ||= appBufferClient(token);
      return pending.then((c) => c.createPost(input));
    },
  };
}

export async function productionCaption(args: { brief: string; text: string; names: string[] }): Promise<CaptionResult> {
  const fallback = args.text.trim();
  if (!isAiConfigured()) {
    return {
      text: fallback,
      ai: false,
      warning: fallback ? null : "La IA no está configurada (OPENAI_API_KEY o ANTHROPIC_API_KEY). Se usó un texto simple.",
    };
  }
  try {
    const { content } = await generateAiReply([
      {
        role: "user",
        content:
          "Escribe un pie de foto en español para redes sociales, máximo 400 caracteres, tono cercano, sin hashtags excesivos, sin comillas y sin explicar nada más.\n" +
          `Tema: ${args.brief || "publicación de la marca"}\n` +
          `Texto base: ${fallback || "(ninguno)"}\n` +
          `Archivos: ${args.names.join(", ") || "(ninguno)"}`,
      },
    ]);
    const text = content.replace(/^["'«»]+|["'«»]+$/g, "").trim().slice(0, 2000);
    if (!text) throw new Error("vacío");
    return { text, ai: true, warning: null };
  } catch {
    return { text: fallback, ai: false, warning: "No se pudo generar el texto con IA. Se usó el texto original." };
  }
}

export async function testBufferCredentials(input: { apiKey?: string; useEnv?: boolean }): Promise<BufferAccountSnapshot> {
  const token = input.useEnv ? bufferEnvKey() : String(input.apiKey || "").trim();
  if (input.useEnv && !token) throw new BufferApiError(BUFFER_MSG.envMissing, 0, "missing");
  if (!token) throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
  const snap = await (await appBufferClient(token)).inspect();
  if (!snap.organizations.length)
    throw new BufferApiError("La cuenta de Buffer no tiene organizaciones.", 400, "graphql");
  return snap;
}

export async function connectBufferAccount(
  userId: string,
  input: { apiKey?: string; useEnv?: boolean; refresh?: boolean; organizationId?: string; channelIds?: string[] }
) {
  const cfg = await getBufferConfig(userId);
  const crm = await getCrmState(userId);
  const crmKey = bufferFromCrm(crm).apiKey;
  let method: BufferAuthRecord["method"] = "api_key";
  let token = "";
  if (input.refresh) {
    if (!cfg.auth) throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
    method = cfg.auth.method;
    token = await resolveBufferToken(cfg, crmKey);
  } else if (input.useEnv) {
    method = "env";
    token = bufferEnvKey();
    if (!token) throw new BufferApiError(BUFFER_MSG.envMissing, 0, "missing");
  } else {
    method = "api_key";
    token = String(input.apiKey || "").trim();
    if (!token) throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
  }
  const snap = await (await appBufferClient(token)).inspect();
  const org = pickOrg(snap, input.organizationId || cfg.auth?.organizationId);
  if (!org) throw new BufferApiError(BUFFER_MSG.noChannels, 400, "graphql");
  const allowed = new Set(org.channels.map((c) => c.id));
  let channelIds = (input.channelIds || [])
    .map((id) => String(id).toLowerCase())
    .filter((id) => allowed.has(id));
  if (!input.channelIds?.length) {
    const previous = (cfg.auth?.channelIds || []).filter((id) => allowed.has(id));
    channelIds = previous.length ? previous : org.channels.filter((c) => !c.isLocked && !c.isDisconnected).map((c) => c.id);
  }
  if (!channelIds.length) throw new BufferApiError(BUFFER_MSG.noChannels, 400, "graphql");
  const auth: BufferAuthRecord = {
    method,
    apiKey: method === "api_key" ? token : "",
    accessToken: method === "oauth" ? cfg.auth?.accessToken || token : "",
    refreshToken: method === "oauth" ? cfg.auth?.refreshToken || "" : "",
    accessTokenExpiresAt: method === "oauth" ? cfg.auth?.accessTokenExpiresAt || "" : "",
    accountId: snap.accountId,
    accountEmail: snap.email,
    organizationId: org.id,
    organizationName: org.name,
    channels: cleanChannels(org.channels),
    channelIds,
    verifiedAt: new Date().toISOString(),
  };
  cfg.auth = auth;
  if (!cfg.schedule.channelIds.length) cfg.schedule.channelIds = channelIds;
  await saveBufferConfig(userId, cfg);
  await writeCrm(userId, crm, auth);
  return { integration: integrationFromAuth(auth), organizations: snap.organizations };
}

export async function disconnectBufferAccount(userId: string) {
  const cfg = await getBufferConfig(userId);
  cfg.auth = null;
  cfg.schedule.enabled = false;
  await saveBufferConfig(userId, cfg);
  await writeCrm(userId, await getCrmState(userId), null);
}

export async function bufferStatus(userId: string) {
  const cfg = await getBufferConfig(userId);
  const crm = bufferFromCrm(await getCrmState(userId));
  const auth = cfg.auth;
  const connected = Boolean(
    (auth && (auth.method === "env" || auth.apiKey || auth.accessToken || auth.refreshToken)) ||
      (crm.connected && crm.apiKey)
  );
  return {
    connected,
    authMethod: auth?.method || (crm.connected ? crm.authMethod : ""),
    accountEmail: auth?.accountEmail || crm.accountEmail,
    accountId: auth?.accountId || crm.accountId,
    organizationId: auth?.organizationId || crm.organizationId,
    organizationName: auth?.organizationName || crm.organizationName,
    channelIds: auth?.channelIds?.length ? auth.channelIds : crm.channelIds,
    channels: auth?.channels?.length ? auth.channels : crm.channels,
    verifiedAt: auth?.verifiedAt || crm.verifiedAt,
    oauthAvailable: oauthConfigured(),
    envAvailable: Boolean(bufferEnvKey()),
    hasApiKey: Boolean(auth?.apiKey || crm.apiKey),
    scheduleEnabled: cfg.schedule.enabled,
  };
}

async function ensureChannels(cfg: BufferConfig, token: string, requested: string[]): Promise<BufferChannelInfo[]> {
  const known = new Map((cfg.auth?.channels || []).map((c) => [c.id, c]));
  const missing = requested.some((id) => !known.has(id));
  if (missing || !cfg.auth?.channels?.length) {
    const snap = await (await appBufferClient(token)).inspect();
    const org = pickOrg(snap, cfg.auth?.organizationId);
    if (org && cfg.auth) {
      cfg.auth.channels = cleanChannels(org.channels);
      cfg.auth.organizationId = org.id;
      cfg.auth.organizationName = org.name;
      cfg.auth.accountEmail = snap.email || cfg.auth.accountEmail;
      cfg.auth.accountId = snap.accountId || cfg.auth.accountId;
    }
  }
  const map = new Map((cfg.auth?.channels || []).map((c) => [c.id, c]));
  return requested.map((id) => map.get(id)).filter((c): c is BufferChannelInfo => !!c);
}

export async function sendBufferPost(
  userId: string,
  input: {
    text?: string;
    media?: Partial<BufferMedia>[];
    channelIds?: string[];
    mode?: "queue" | "custom" | "now";
    dueAt?: string | null;
    aiAssisted?: boolean;
  }
) {
  const ran = await withBufferLock(userId, async () => {
    const cfg = await getBufferConfig(userId);
    const crm = await getCrmState(userId);
    const token = await resolveBufferToken(cfg, bufferFromCrm(crm).apiKey);
    const requested = (input.channelIds?.length ? input.channelIds : cfg.auth?.channelIds || cfg.schedule.channelIds)
      .map((id) => String(id).toLowerCase())
      .filter((id) => isBufferId(id));
    if (!requested.length) throw new BufferApiError(BUFFER_MSG.pickChannel, 400, "mutation");
    const channels = await ensureChannels(cfg, token, requested);
    if (channels.length !== requested.length) {
      throw new BufferApiError("Alguno de los canales no está en tu cuenta de Buffer. Actualízalos en Integraciones.", 400, "mutation");
    }
    const rawMedia = Array.isArray(input.media) ? input.media : [];
    const media: BufferMedia[] = rawMedia
      .filter((m) => m && isHttpsUrl(String(m.url || "")))
      .slice(0, 10)
      .map((m) => ({
        url: String(m.url),
        kind: m.kind === "video" ? "video" : "image",
        name: String(m.name || "media").slice(0, 160),
      }));
    if (rawMedia.length !== media.length) {
      throw new BufferApiError("Hay medios sin URL pública (https). Vuelve a adjuntarlos desde la galería.", 400, "mutation");
    }
    const text = String(input.text || "").trim();
    if (!text && media.length === 0) throw new BufferApiError(BUFFER_MSG.noText, 400, "mutation");
    const mode: BufferPostMode = input.mode === "now" ? "shareNow" : input.mode === "custom" ? "customScheduled" : "addToQueue";
    if (mode === "customScheduled") {
      const when = new Date(String(input.dueAt || ""));
      if (Number.isNaN(+when)) throw new BufferApiError(BUFFER_MSG.badTime, 400, "mutation");
    }
    const logs = await deliverToChannels({
      channels,
      text: text || media[0]?.name || "Publicación",
      media,
      mode,
      dueAt: mode === "customScheduled" ? new Date(String(input.dueAt)).toISOString() : null,
      aiAssisted: Boolean(input.aiAssisted),
      source: "manual",
      warning: null,
      now: new Date(),
      createPost: clientFor(token).createPost,
    });
    cfg.logs = [...logs.slice().reverse(), ...cfg.logs].slice(0, 200);
    await saveBufferConfig(userId, cfg);
    const ok = logs.some((l) => l.ok);
    return { logs, ok, error: ok ? null : logs.find((l) => l.error)?.error || "No se pudo enviar a Buffer." };
  });
  if (!ran) throw new BufferApiError("Buffer está procesando otro envío. Espera un momento y reintenta.", 409, "network");
  return ran;
}

export async function getBufferSchedule(userId: string) {
  const cfg = await getBufferConfig(userId);
  return { schedule: cfg.schedule, logs: cfg.logs.slice(0, 50) };
}

export async function saveBufferSchedule(
  userId: string,
  body: {
    enabled?: boolean;
    times?: unknown;
    timezone?: string;
    channelIds?: string[];
    mode?: string;
    source?: string;
    aiCaptions?: boolean;
    aiBrief?: string;
    resetUsed?: boolean;
  }
) {
  const cfg = await getBufferConfig(userId);
  const times = normalizeTimes(body.times);
  if (body.enabled && !times.length) throw new BufferApiError("Añade al menos una hora del día (HH:mm).", 400, "mutation");
  const known = new Set((cfg.auth?.channels || []).map((c) => c.id));
  const channelIds = Array.isArray(body.channelIds)
    ? body.channelIds.map((id) => String(id).toLowerCase()).filter((id) => isBufferId(id) && (!known.size || known.has(id)))
    : cfg.schedule.channelIds;
  if (body.enabled && !channelIds.length) throw new BufferApiError(BUFFER_MSG.pickChannel, 400, "mutation");
  const source = body.source === "drafts" || body.source === "gallery" || body.source === "both" ? body.source : cfg.schedule.source;
  cfg.schedule = {
    ...cfg.schedule,
    enabled: Boolean(body.enabled),
    times: times.length ? times : cfg.schedule.times,
    timezone: safeTimeZone(String(body.timezone || cfg.schedule.timezone)),
    channelIds,
    mode: body.mode === "fixed" ? "fixed" : "queue",
    source,
    aiCaptions: Boolean(body.aiCaptions),
    aiBrief: String(body.aiBrief || "").slice(0, 500),
    usedDraftIds: body.resetUsed ? [] : cfg.schedule.usedDraftIds,
    usedAssetIds: body.resetUsed ? [] : cfg.schedule.usedAssetIds,
  };
  await saveBufferConfig(userId, cfg);
  return { schedule: cfg.schedule, logs: cfg.logs.slice(0, 50) };
}

export async function storeOAuthTokens(
  userId: string,
  pair: { accessToken: string; refreshToken: string; expiresAt: string }
) {
  const cfg = await getBufferConfig(userId);
  cfg.auth = {
    method: "oauth",
    apiKey: "",
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    accessTokenExpiresAt: pair.expiresAt,
    accountId: cfg.auth?.accountId || "",
    accountEmail: cfg.auth?.accountEmail || "",
    organizationId: cfg.auth?.organizationId || "",
    organizationName: cfg.auth?.organizationName || "",
    channels: cfg.auth?.channels || [],
    channelIds: cfg.auth?.channelIds || [],
    verifiedAt: "",
  };
  await saveBufferConfig(userId, cfg);
  return connectBufferAccount(userId, { refresh: true });
}

export async function runDueBuffer(deadline: number) {
  const ids = await listDailyUserIds();
  const summary = { users: ids.length, due: 0, sent: 0, failed: 0, skipped: 0 };
  for (const userId of ids) {
    if (Date.now() + 15_000 > deadline) {
      summary.skipped++;
      continue;
    }
    try {
      const ran = await withBufferLock(userId, async () => {
        const cfg = await getBufferConfig(userId);
        if (!cfg.schedule.enabled) return { due: 0, sent: 0, failed: 0 };
        const crm = await getCrmState(userId);
        const studio = await listAssets(userId).catch(() => []);
        const result = await runDailyPass({
          now: new Date(),
          config: cfg,
          drafts: (crm?.socialPosts || []).map((p) => ({
            id: p.id,
            body: p.body || "",
            status: p.status,
            mediaIds: p.mediaIds || [],
            createdAt: p.createdAt,
          })),
          assets: [
            ...(crm?.mediaAssets || []).map((a) => ({
              id: a.id,
              url: a.url,
              kind: a.kind,
              name: a.name,
              createdAt: a.createdAt,
            })),
            ...studioGalleryAssets(studio),
          ],
          resolveToken: (c) => resolveBufferToken(c, bufferFromCrm(crm).apiKey),
          clientFor,
          caption: productionCaption,
        });
        if (studio.length > 0 && studioGalleryAssets(studio).length === 0) {
          const waiting = result.config.logs.find((log) => log.error === BUFFER_MSG.emptyContent);
          if (waiting) {
            waiting.error =
              "Hay creaciones del estudio, pero sin URL pública. Buffer solo publica archivos https (conecta Blob) o adjúntalas desde Marketing.";
          }
        }
        await saveBufferConfig(userId, result.config);
        return result;
      });
      if (!ran) {
        summary.skipped++;
        continue;
      }
      summary.due += ran.due;
      summary.sent += ran.sent;
      summary.failed += ran.failed;
    } catch (e) {
      summary.failed++;
      console.error("[cron/buffer]", userId, e);
    }
  }
  return summary;
}
