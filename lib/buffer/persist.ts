import { acquireLock, getJson, releaseLock, setAdd, setJson, setMembers, setRemove } from "../kvStore";
import { blankConfig, blankSchedule, type BufferAuthRecord, type BufferConfig, type BufferDailySchedule } from "./model";

export const BUFFER_DAILY_SET = "enone:buffer:daily";

const cfgKey = (userId: string) => `enone:buffer:cfg:${userId}`;
const oauthKey = (state: string) => `enone:buffer:oauth:${state}`;

export type OAuthPending = { userId: string; verifier: string; exp: number };

function coerceSchedule(raw: Partial<BufferDailySchedule> | undefined): BufferDailySchedule {
  const base = blankSchedule();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    times: Array.isArray(raw.times) && raw.times.length ? raw.times : base.times,
    channelIds: Array.isArray(raw.channelIds) ? raw.channelIds : [],
    usedDraftIds: Array.isArray(raw.usedDraftIds) ? raw.usedDraftIds : [],
    usedAssetIds: Array.isArray(raw.usedAssetIds) ? raw.usedAssetIds : [],
    pinnedAssetIds: Array.isArray(raw.pinnedAssetIds) ? raw.pinnedAssetIds.map(String) : [],
    pinnedPlacements: raw.pinnedPlacements && typeof raw.pinnedPlacements === "object" ? raw.pinnedPlacements : {},
    fired: raw.fired && typeof raw.fired === "object" ? raw.fired : {},
    noted: raw.noted && typeof raw.noted === "object" ? raw.noted : {},
    attempts: raw.attempts && typeof raw.attempts === "object" ? raw.attempts : {},
    aiBrief: String(raw.aiBrief || ""),
  };
}

export async function getBufferConfig(userId: string): Promise<BufferConfig> {
  const raw = await getJson<Partial<BufferConfig>>(cfgKey(userId));
  if (!raw) return blankConfig();
  return {
    auth: raw.auth || null,
    schedule: coerceSchedule(raw.schedule),
    logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 200) : [],
  };
}

export async function saveBufferConfig(userId: string, cfg: BufferConfig): Promise<void> {
  await setJson(cfgKey(userId), cfg);
  if (cfg.schedule.enabled) await setAdd(BUFFER_DAILY_SET, userId);
  else await setRemove(BUFFER_DAILY_SET, userId);
}

export async function listDailyUserIds(): Promise<string[]> {
  return setMembers(BUFFER_DAILY_SET);
}

export async function withBufferLock<T>(userId: string, fn: () => Promise<T>): Promise<T | null> {
  const key = `enone:buffer:lock:${userId}`;
  if (!(await acquireLock(key, 120))) return null;
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}

export async function saveOAuthPending(state: string, pending: OAuthPending): Promise<void> {
  await setJson(oauthKey(state), pending);
}

export async function takeOAuthPending(state: string): Promise<OAuthPending | null> {
  const pending = await getJson<OAuthPending>(oauthKey(state));
  if (pending) await setJson(oauthKey(state), null);
  return pending;
}

export function publicAuth(auth: BufferAuthRecord | null) {
  if (!auth) return null;
  return {
    method: auth.method,
    accountId: auth.accountId,
    accountEmail: auth.accountEmail,
    organizationId: auth.organizationId,
    organizationName: auth.organizationName,
    channels: auth.channels,
    channelIds: auth.channelIds,
    verifiedAt: auth.verifiedAt,
    hasApiKey: Boolean(auth.apiKey),
    hasRefresh: Boolean(auth.refreshToken),
  };
}
