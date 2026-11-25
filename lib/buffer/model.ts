import type { BufferChannelInfo, BufferIntegration, CrmState } from "../types";

export type BufferAuthMethod = "api_key" | "oauth" | "env";
export type BufferScheduleMode = "queue" | "fixed";
export type BufferContentSource = "drafts" | "gallery" | "both";
export type BufferPostMode = "addToQueue" | "customScheduled" | "shareNow" | "shareNext";

export type BufferAuthRecord = {
  method: BufferAuthMethod;
  apiKey: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  accountId: string;
  accountEmail: string;
  organizationId: string;
  organizationName: string;
  channels: BufferChannelInfo[];
  channelIds: string[];
  verifiedAt: string;
};

export type BufferDailySchedule = {
  enabled: boolean;
  times: string[];
  timezone: string;
  channelIds: string[];
  mode: BufferScheduleMode;
  source: BufferContentSource;
  aiCaptions: boolean;
  aiBrief: string;
  usedDraftIds: string[];
  usedAssetIds: string[];
  /** Creative-studio asset ids the owner asked to send on the next daily slots. */
  pinnedAssetIds: string[];
  /** Instagram placement chosen when that creation was pinned. */
  pinnedPlacements: Record<string, "post" | "story" | "reel">;
  /** slot HH:mm → local date YYYY-MM-DD already delivered */
  fired: Record<string, string>;
  /** slot HH:mm → local date we already logged a waiting error */
  noted: Record<string, string>;
  /** `${date}|${slot}` → failed delivery attempts */
  attempts: Record<string, number>;
};

export type BufferSendLog = {
  id: string;
  at: string;
  source: "manual" | "daily" | "queued";
  channelId: string;
  channelName: string;
  service: string;
  text: string;
  mediaCount: number;
  mode: BufferPostMode;
  dueAt: string | null;
  bufferPostId: string | null;
  ok: boolean;
  error: string | null;
  warning: string | null;
};

export type BufferConfig = {
  auth: BufferAuthRecord | null;
  schedule: BufferDailySchedule;
  logs: BufferSendLog[];
};

export type BufferMedia = { url: string; kind: "image" | "video"; name: string };

export const BUFFER_ID = /^[a-f0-9]{24}$/i;

export function blankBufferIntegration(): BufferIntegration {
  return {
    connected: false,
    apiKey: "",
    authMethod: "",
    accountEmail: "",
    accountId: "",
    organizationId: "",
    organizationName: "",
    channelIds: [],
    channels: [],
    verifiedAt: "",
  };
}

export function blankSchedule(): BufferDailySchedule {
  return {
    enabled: false,
    times: ["09:00"],
    timezone: "America/Mexico_City",
    channelIds: [],
    mode: "queue",
    source: "both",
    aiCaptions: false,
    aiBrief: "",
    usedDraftIds: [],
    usedAssetIds: [],
    pinnedAssetIds: [],
    pinnedPlacements: {},
    fired: {},
    noted: {},
    attempts: {},
  };
}

export function blankConfig(): BufferConfig {
  return { auth: null, schedule: blankSchedule(), logs: [] };
}

export function isBufferId(id: string): boolean {
  return BUFFER_ID.test(id);
}

export function cleanChannels(value: unknown): BufferChannelInfo[] {
  if (!Array.isArray(value)) return [];
  const out: BufferChannelInfo[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Partial<BufferChannelInfo>;
    const id = String(c.id || "");
    if (!isBufferId(id)) continue;
    const avatar = String(c.avatar || "");
    out.push({
      id: id.toLowerCase(),
      name: String(c.name || "").slice(0, 120),
      displayName: String(c.displayName || "").slice(0, 120),
      service: String(c.service || "").slice(0, 40),
      type: String(c.type || "").slice(0, 40),
      avatar: /^https:\/\//i.test(avatar) ? avatar : "",
      descriptor: String(c.descriptor || "").slice(0, 160),
      isDisconnected: Boolean(c.isDisconnected),
      isLocked: Boolean(c.isLocked),
      isQueuePaused: Boolean(c.isQueuePaused),
      organizationId: String(c.organizationId || "").toLowerCase(),
    });
    if (out.length >= 50) break;
  }
  return out;
}

export function normalizeBufferIntegration(raw: Partial<BufferIntegration> | null | undefined): BufferIntegration {
  const base = blankBufferIntegration();
  if (!raw) return base;
  const method = raw.authMethod;
  return {
    ...base,
    connected: Boolean(raw.connected),
    apiKey: String(raw.apiKey || ""),
    authMethod: method === "api_key" || method === "oauth" || method === "env" ? method : "",
    accountEmail: String(raw.accountEmail || "").slice(0, 200),
    accountId: String(raw.accountId || "").slice(0, 80),
    organizationId: isBufferId(String(raw.organizationId || "")) ? String(raw.organizationId).toLowerCase() : "",
    organizationName: String(raw.organizationName || "").slice(0, 160),
    channelIds: Array.isArray(raw.channelIds)
      ? raw.channelIds.map((id) => String(id).toLowerCase()).filter((id) => isBufferId(id)).slice(0, 50)
      : [],
    channels: cleanChannels(raw.channels),
    verifiedAt: String(raw.verifiedAt || "").slice(0, 40),
  };
}

export function normalizeIntegrations<T extends { buffer?: Partial<BufferIntegration> }>(raw: T | null | undefined): T & { buffer: BufferIntegration } {
  const src = (raw || {}) as T;
  return { ...src, buffer: normalizeBufferIntegration(src.buffer) };
}

export function bufferFromCrm(state: CrmState | null): BufferIntegration {
  return normalizeBufferIntegration(state?.integrations?.buffer);
}

export function integrationFromAuth(auth: BufferAuthRecord | null): BufferIntegration {
  if (!auth) return blankBufferIntegration();
  return {
    connected: true,
    apiKey: auth.method === "api_key" ? auth.apiKey : "",
    authMethod: auth.method,
    accountEmail: auth.accountEmail,
    accountId: auth.accountId,
    organizationId: auth.organizationId,
    organizationName: auth.organizationName,
    channelIds: auth.channelIds,
    channels: auth.channels,
    verifiedAt: auth.verifiedAt,
  };
}

export function safeTimeZone(tz: string): string {
  const value = tz.trim() || "America/Mexico_City";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "America/Mexico_City";
  }
}

export function normalizeTimes(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const item of raw) {
    const match = String(item).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) continue;
    const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (!out.includes(slot)) out.push(slot);
    if (out.length >= 8) break;
  }
  return out.sort();
}

export function newBufferId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function serviceLabel(service: string): string {
  const key = service.toLowerCase();
  const names: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X",
    x: "X",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    threads: "Threads",
    bluesky: "Bluesky",
    mastodon: "Mastodon",
    youtube: "YouTube",
    googlebusiness: "Google Business",
    startpage: "Start Page",
    substack: "Substack",
  };
  return names[key] || service || "Canal";
}
