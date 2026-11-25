import { postText } from "../creative/copy";
import { BUFFER_MSG } from "./messages";
import {
  isHttpsUrl,
  safeTimeZone,
  type BufferConfig,
  type BufferDailySchedule,
  type BufferMedia,
} from "./model";

export type DraftRef = {
  id: string;
  body: string;
  status: string;
  mediaIds: string[];
  createdAt: string;
};

export type AssetRef = {
  id: string;
  url?: string;
  kind: "image" | "video";
  name: string;
  createdAt: string;
  /** Saved studio caption plus hashtags, when the asset already has them. */
  text?: string;
};

/** Creative-studio gallery items Buffer can publish. Only public https URLs are kept. */
export function studioGalleryAssets(
  items: { id: string; url: string; kind: "image" | "video"; name: string; createdAt: string; caption?: string; hashtags?: string[] }[]
): AssetRef[] {
  return items
    .filter((item) => item.url.startsWith("https://"))
    .map((item) => ({
      id: item.id.startsWith("creative:") ? item.id : `creative:${item.id}`,
      url: item.url,
      kind: item.kind,
      name: item.name,
      createdAt: item.createdAt,
      text: postText(item.caption, item.hashtags),
    }));
}

export type PickedContent = {
  kind: "draft" | "asset";
  refId: string;
  text: string;
  media: BufferMedia[];
  names: string[];
  warning: string | null;
};

export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  const tz = safeTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) bag[p.type] = p.value;
  const hour = bag.hour === "24" ? 0 : Number(bag.hour);
  return { date: `${bag.year}-${bag.month}-${bag.day}`, minutes: hour * 60 + Number(bag.minute) };
}

/** Convert a wall-clock slot in `timeZone` to a UTC Date. */
export function zonedSlotToUtc(date: string, time: string, timeZone: string): Date {
  const tz = safeTimeZone(timeZone);
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const read = (ms: number) => {
    const bag: Record<string, string> = {};
    for (const p of fmt.formatToParts(new Date(ms))) bag[p.type] = p.value;
    const hour = bag.hour === "24" ? 0 : Number(bag.hour);
    return Date.UTC(Number(bag.year), Number(bag.month) - 1, Number(bag.day), hour, Number(bag.minute), Number(bag.second));
  };
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  let utc = target;
  for (let i = 0; i < 4; i++) {
    const delta = read(utc) - target;
    if (delta === 0) break;
    utc -= delta;
  }
  return new Date(utc);
}

export function dueSlots(now: Date, schedule: BufferDailySchedule): string[] {
  if (!schedule.enabled || schedule.times.length === 0) return [];
  const { date, minutes } = localParts(now, schedule.timezone);
  return [...schedule.times].sort().filter((slot) => {
    const [h, m] = slot.split(":").map(Number);
    if (h * 60 + m > minutes) return false;
    return schedule.fired[slot] !== date;
  });
}

function byCreated(a: { createdAt: string }, b: { createdAt: string }) {
  return +new Date(a.createdAt) - +new Date(b.createdAt);
}

export function pinDailyAsset(
  schedule: BufferDailySchedule,
  assetId: string,
  channelIds: string[],
  instagramType?: "post" | "story" | "reel"
): BufferDailySchedule {
  const id = assetId.replace(/^creative:/, "").trim();
  const pinned = schedule.pinnedAssetIds.includes(id) ? schedule.pinnedAssetIds : [...schedule.pinnedAssetIds, id].slice(0, 40);
  const placements = { ...(schedule.pinnedPlacements || {}) };
  if (instagramType) placements[id] = instagramType;
  return {
    ...schedule,
    enabled: true,
    times: schedule.times.length ? schedule.times : ["09:00"],
    source: schedule.source === "drafts" ? "both" : schedule.source,
    channelIds: channelIds.length ? channelIds : schedule.channelIds,
    pinnedAssetIds: pinned,
    pinnedPlacements: placements,
  };
}

export function pickDailyContent(opts: {
  source: BufferDailySchedule["source"];
  drafts: DraftRef[];
  assets: AssetRef[];
  usedDraftIds: string[];
  usedAssetIds: string[];
  pinnedIds?: string[];
}): PickedContent | null {
  const usedDrafts = new Set(opts.usedDraftIds);
  const usedAssets = new Set(opts.usedAssetIds);
  const drafts = opts.drafts
    .filter((d) => d.status === "draft" && !usedDrafts.has(d.id) && (d.body.trim() || d.mediaIds.length))
    .sort(byCreated);
  const usedWithDraft = new Set(opts.drafts.filter((d) => usedDrafts.has(d.id)).flatMap((d) => d.mediaIds));
  const assets = opts.assets
    .filter(
      (a) =>
        (a.kind === "image" || a.kind === "video") &&
        a.url &&
        isHttpsUrl(a.url) &&
        !usedAssets.has(a.id) &&
        !usedWithDraft.has(a.id)
    )
    .sort(byCreated);
  const assetById = new Map(opts.assets.map((a) => [a.id, a]));

  const pinOrder = opts.pinnedIds || [];
  const pinRank = (id: string) => {
    const bare = id.replace(/^creative:/, "");
    const index = pinOrder.findIndex((pin) => pin === id || pin === bare || `creative:${pin}` === id);
    return index === -1 ? 9999 : index;
  };
  const pinned = [...assets].filter((asset) => pinRank(asset.id) < 9999).sort((a, b) => pinRank(a.id) - pinRank(b.id));
  if (pinned.length && pinned[0].url && isHttpsUrl(pinned[0].url)) {
    const asset = pinned[0];
    const url = asset.url as string;
    return {
      kind: "asset",
      refId: asset.id,
      text: (asset.text || "").trim(),
      media: [{ url, kind: asset.kind, name: asset.name }],
      names: [asset.name],
      warning: null,
    };
  }

  const takeDraft = opts.source === "drafts" || opts.source === "both";
  const takeAsset = opts.source === "gallery" || opts.source === "both";

  if (takeDraft && drafts.length) {
    const draft = drafts[0];
    const media: BufferMedia[] = [];
    let skipped = 0;
    for (const id of draft.mediaIds) {
      const asset = assetById.get(id);
      if (!asset) continue;
      if (!asset.url || !isHttpsUrl(asset.url)) {
        skipped++;
        continue;
      }
      media.push({ url: asset.url, kind: asset.kind, name: asset.name });
    }
    return {
      kind: "draft",
      refId: draft.id,
      text: draft.body.trim(),
      media,
      names: media.map((m) => m.name),
      warning: skipped
        ? "Algunos archivos del borrador no tienen URL pública y no se adjuntaron."
        : null,
    };
  }
  if (takeAsset && assets.length) {
    const asset = assets[0];
    return {
      kind: "asset",
      refId: asset.id,
      text: (asset.text || "").trim(),
      media: [{ url: asset.url!, kind: asset.kind, name: asset.name }],
      names: [asset.name],
      warning: null,
    };
  }
  return null;
}

export function futureIso(iso: string | null, now: Date): { iso: string; bumped: boolean } {
  const min = now.getTime() + 90_000;
  const t = iso ? +new Date(iso) : NaN;
  const when = Number.isFinite(t) ? Math.max(t, min) : min;
  return { iso: new Date(when).toISOString(), bumped: !Number.isFinite(t) || t < min };
}

export function pruneOldMarks(schedule: BufferDailySchedule, today: string) {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 21);
  const min = cutoff.toISOString().slice(0, 10);
  for (const bag of [schedule.fired, schedule.noted]) {
    for (const key of Object.keys(bag)) if (bag[key] < min) delete bag[key];
  }
  for (const key of Object.keys(schedule.attempts)) {
    const date = key.split("|")[0];
    if (date && date < min) delete schedule.attempts[key];
  }
}

export function waitingMessage(kind: "creds" | "channels" | "content" | "error", detail?: string): string {
  if (kind === "creds") return detail || BUFFER_MSG.missing;
  if (kind === "channels") return BUFFER_MSG.pickChannel;
  if (kind === "content") return BUFFER_MSG.emptyContent;
  return detail || "No se pudo enviar la publicación diaria a Buffer.";
}

export function configChannels(cfg: BufferConfig) {
  const ids = cfg.schedule.channelIds.length ? cfg.schedule.channelIds : cfg.auth?.channelIds || [];
  const known = new Map((cfg.auth?.channels || []).map((c) => [c.id, c]));
  return ids.map(
    (id) =>
      known.get(id) || {
        id,
        name: id,
        displayName: id,
        service: "",
        type: "",
        avatar: "",
        descriptor: "",
        isDisconnected: false,
        isLocked: false,
        isQueuePaused: false,
        organizationId: cfg.auth?.organizationId || "",
      }
  );
}
