import type { BufferClient } from "./client";
import { BufferApiError } from "./client";
import { serviceLabel } from "./model";
import {
  blankConfig,
  newBufferId,
  type BufferConfig,
  type BufferMedia,
  type BufferPostMode,
  type BufferSendLog,
} from "./model";
import type { BufferChannelInfo } from "../types";
import {
  configChannels,
  dueSlots,
  futureIso,
  localParts,
  pickDailyContent,
  pruneOldMarks,
  waitingMessage,
  zonedSlotToUtc,
  type AssetRef,
  type DraftRef,
} from "./schedule";

const MAX_ATTEMPTS = 3;

export type CaptionResult = { text: string; ai: boolean; warning: string | null };

export type DailyDeps = {
  now: Date;
  config: BufferConfig;
  drafts: DraftRef[];
  assets: AssetRef[];
  /** Returns a bearer token. May refresh OAuth and mutate `cfg.auth`. */
  resolveToken: (cfg: BufferConfig) => Promise<string>;
  clientFor: (token: string) => Pick<BufferClient, "createPost">;
  caption: (args: { brief: string; text: string; names: string[] }) => Promise<CaptionResult>;
};

function pushLog(cfg: BufferConfig, log: BufferSendLog) {
  cfg.logs.unshift(log);
  cfg.logs = cfg.logs.slice(0, 200);
}

function noteOnce(cfg: BufferConfig, slot: string, date: string, error: string) {
  if (cfg.schedule.noted[slot] === date) return;
  cfg.schedule.noted[slot] = date;
  pushLog(cfg, {
    id: newBufferId("bf"),
    at: new Date().toISOString(),
    source: "daily",
    channelId: "",
    channelName: "",
    service: "",
    text: "",
    mediaCount: 0,
    mode: cfg.schedule.mode === "fixed" ? "customScheduled" : "addToQueue",
    dueAt: null,
    bufferPostId: null,
    ok: false,
    error,
    warning: null,
  });
}

export async function deliverToChannels(opts: {
  channels: BufferChannelInfo[];
  text: string;
  media: BufferMedia[];
  mode: BufferPostMode;
  dueAt: string | null;
  aiAssisted: boolean;
  source: "manual" | "daily";
  warning: string | null;
  now: Date;
  createPost: BufferClient["createPost"];
}): Promise<BufferSendLog[]> {
  const logs: BufferSendLog[] = [];
  let due = opts.dueAt;
  let bumped = false;
  if (opts.mode === "customScheduled") {
    const next = futureIso(opts.dueAt, opts.now);
    due = next.iso;
    bumped = next.bumped;
  }
  for (const ch of opts.channels) {
    const base: BufferSendLog = {
      id: newBufferId("bf"),
      at: opts.now.toISOString(),
      source: opts.source,
      channelId: ch.id,
      channelName: ch.displayName || ch.name || ch.id,
      service: ch.service,
      text: opts.text.slice(0, 500),
      mediaCount: opts.media.length,
      mode: opts.mode,
      dueAt: due,
      bufferPostId: null,
      ok: false,
      error: null,
      warning: [opts.warning, bumped ? "La hora ya había pasado; se programó unos minutos más tarde." : null]
        .filter(Boolean)
        .join(" ") || null,
    };
    if (ch.isLocked) {
      base.error = `${serviceLabel(ch.service)} está bloqueado en Buffer (el plan no alcanza para este perfil).`;
      logs.push(base);
      continue;
    }
    if (ch.isDisconnected) {
      base.error = `${serviceLabel(ch.service)} está desconectado en Buffer. Vuelve a vincularlo en buffer.com.`;
      logs.push(base);
      continue;
    }
    if (ch.isQueuePaused && opts.mode === "addToQueue") {
      base.warning = [base.warning, "La cola de este canal está en pausa en Buffer; no se publicará hasta que la reanudes."].filter(Boolean).join(" ");
    }
    try {
      const post = await opts.createPost({
        channelId: ch.id,
        text: opts.text,
        mode: opts.mode,
        dueAt: due,
        media: opts.media,
        aiAssisted: opts.aiAssisted,
      });
      base.ok = true;
      base.bufferPostId = post.id;
      base.dueAt = post.dueAt || due;
      if (post.schedulingType === "notification") {
        base.warning = [base.warning, "Buffer solo enviará un recordatorio: este perfil no admite publicación automática."].filter(Boolean).join(" ");
      }
      if (post.warning) base.warning = [base.warning, post.warning].filter(Boolean).join(" ");
    } catch (e) {
      base.error = e instanceof BufferApiError ? e.message : "No se pudo enviar a Buffer.";
    }
    logs.push(base);
  }
  return logs;
}

/**
 * One cron pass for a single user. Mutates and returns `deps.config`
 * (logs, fired slots, used drafts/assets). Does not persist.
 */
export async function runDailyPass(deps: DailyDeps): Promise<{ config: BufferConfig; due: number; sent: number; failed: number }> {
  const cfg = deps.config || blankConfig();
  const schedule = cfg.schedule;
  if (!schedule.enabled) return { config: cfg, due: 0, sent: 0, failed: 0 };
  const slots = dueSlots(deps.now, schedule);
  const { date } = localParts(deps.now, schedule.timezone);
  pruneOldMarks(schedule, date);
  if (!slots.length) return { config: cfg, due: 0, sent: 0, failed: 0 };

  let createPost: BufferClient["createPost"];
  try {
    const token = await deps.resolveToken(cfg);
    if (!token.trim()) throw new BufferApiError(waitingMessage("creds"), 0, "missing");
    createPost = deps.clientFor(token).createPost;
  } catch (e) {
    const message = e instanceof BufferApiError ? e.message : waitingMessage("creds");
    for (const slot of slots) noteOnce(cfg, slot, date, message);
    return { config: cfg, due: slots.length, sent: 0, failed: slots.length };
  }

  let sent = 0;
  let failed = 0;
  for (const slot of slots) {
    const channels = configChannels(cfg).filter((c) => c.id);
    if (!channels.length) {
      noteOnce(cfg, slot, date, waitingMessage("channels"));
      failed++;
      continue;
    }
    const item = pickDailyContent({
      source: schedule.source,
      drafts: deps.drafts,
      assets: deps.assets,
      usedDraftIds: schedule.usedDraftIds,
      usedAssetIds: schedule.usedAssetIds,
    });
    if (!item) {
      noteOnce(cfg, slot, date, waitingMessage("content"));
      failed++;
      continue;
    }
    let text = item.text;
    let ai = false;
    let warning = item.warning;
    const savedCaption = item.kind === "asset" && item.text.trim();
    if (schedule.aiCaptions && !savedCaption) {
      try {
        const cap = await deps.caption({ brief: schedule.aiBrief, text, names: item.names });
        if (cap.text.trim()) text = cap.text.trim();
        ai = cap.ai;
        if (cap.warning) warning = [warning, cap.warning].filter(Boolean).join(" ");
      } catch {
        warning = [warning, "No se pudo generar el texto con IA. Se usó el texto original."].filter(Boolean).join(" ");
      }
    }
    if (!text.trim()) text = item.names[0] ? `Nuevo contenido: ${item.names[0]}` : "Publicación del día";

    const mode: BufferPostMode = schedule.mode === "fixed" ? "customScheduled" : "addToQueue";
    const dueAt = mode === "customScheduled" ? zonedSlotToUtc(date, slot, schedule.timezone).toISOString() : null;
    const logs = await deliverToChannels({
      channels,
      text,
      media: item.media,
      mode,
      dueAt,
      aiAssisted: ai,
      source: "daily",
      warning,
      now: deps.now,
      createPost,
    });
    for (const log of logs) pushLog(cfg, log);
    const anyOk = logs.some((l) => l.ok);
    const attemptKey = `${date}|${slot}`;
    if (anyOk) {
      schedule.fired[slot] = date;
      delete schedule.attempts[attemptKey];
      if (item.kind === "draft") schedule.usedDraftIds.push(item.refId);
      else schedule.usedAssetIds.push(item.refId);
      sent++;
    } else {
      const n = (schedule.attempts[attemptKey] || 0) + 1;
      schedule.attempts[attemptKey] = n;
      if (n >= MAX_ATTEMPTS) schedule.fired[slot] = date;
      failed++;
    }
  }
  return { config: cfg, due: slots.length, sent, failed };
}
