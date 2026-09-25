/** Runs a server-side social post (Facebook / Instagram) — used by "Publicar ahora", retry and the cron. */
import type { CrmState, MetaChannel, ScheduledPost, ScheduledPostChannelResult } from "./types";
import { getCrmState } from "./crmDb";
import { acquireLock, releaseLock } from "./kvStore";
import { getPost, listDueMembers, removeDueMember, savePost } from "./socialDb";
import {
  explainGraphError,
  GraphError,
  publishFacebook,
  publishInstagram,
  resolvePageContext,
  type MetaCredentials,
  type PageContext,
  type PublishOutcome,
} from "./metaPublish";

export const MAX_ATTEMPTS = 3;
const LOCK_TTL_SEC = 330;
const STALE_PUBLISHING_MS = 10 * 60 * 1000;

export function metaSetupFromCrm(state: CrmState | null): {
  creds: MetaCredentials;
  connected: Record<MetaChannel, boolean>;
} {
  const conns = state?.socialConnections || [];
  const fb = conns.find((c) => c.id === "facebook");
  const ig = conns.find((c) => c.id === "instagram");
  return {
    creds: {
      accessToken: (fb?.accessToken || ig?.accessToken || "").trim(),
      pageId: (fb?.pageId || ig?.pageId || "").trim(),
      igUserId: (ig?.igUserId || fb?.igUserId || "").trim(),
    },
    connected: { facebook: !!fb?.connected, instagram: !!ig?.connected },
  };
}

function clean(r: PublishOutcome): ScheduledPostChannelResult {
  const { pending: _p, transient: _t, ...rest } = r;
  return rest;
}

export async function processPost(
  userId: string,
  postId: string,
  opts: { deadline: number; autoRetryHardErrors: boolean }
): Promise<ScheduledPost | null> {
  const lockKey = `enone:social:lock:${postId}`;
  if (!(await acquireLock(lockKey, LOCK_TTL_SEC))) return getPost(userId, postId);
  try {
    const post = await getPost(userId, postId);
    if (!post) {
      await removeDueMember(userId, postId);
      return null;
    }
    if (post.status === "published" || post.status === "cancelled") return post;

    post.status = "publishing";
    post.lockedAt = new Date().toISOString();
    await savePost(post);

    const { creds, connected } = metaSetupFromCrm(await getCrmState(userId));
    const todo = post.channels.filter((ch) => !post.results?.[ch]?.ok);
    post.results = post.results || {};

    let ctx: PageContext | null = null;
    let ctxError = "";
    let ctxTransient = false;
    if (todo.some((ch) => connected[ch])) {
      try {
        ctx = await resolvePageContext(creds);
      } catch (e) {
        ctxError = explainGraphError(e);
        ctxTransient = e instanceof GraphError && e.transient;
      }
    }

    let pending = false;
    let transientOnly = true;
    const errorsByMsg = new Map<string, string[]>();
    for (const ch of todo) {
      let out: PublishOutcome;
      const at = new Date().toISOString();
      if (!connected[ch]) {
        out = {
          ok: false,
          error: `${ch === "facebook" ? "Facebook" : "Instagram"} no está conectado en Integraciones.`,
          at,
        };
      } else if (!ctx) {
        out = { ok: false, error: ctxError || "No se pudo conectar con Meta.", transient: ctxTransient, at };
      } else if (ch === "facebook") {
        out = await publishFacebook(ctx, post.body, post.media);
      } else {
        out = await publishInstagram(ctx, post.body, post.media, {
          deadline: opts.deadline,
          resumeContainerId: post.results.instagram?.containerId,
        });
      }
      post.results[ch] = clean(out);
      if (!out.ok) {
        if (out.pending) pending = true;
        else {
          const k = out.error || "Error";
          errorsByMsg.set(k, [...(errorsByMsg.get(k) || []), ch === "facebook" ? "Facebook" : "Instagram"]);
          if (!out.transient) transientOnly = false;
        }
      }
    }

    const errors = Array.from(errorsByMsg.entries()).map(([m, chs]) => `${chs.join(" + ")}: ${m}`);
    const now = Date.now();
    post.lockedAt = null;
    if (post.channels.every((ch) => post.results[ch]?.ok)) {
      post.status = "published";
      post.publishedAt = new Date().toISOString();
      post.lastError = null;
      post.nextAttemptAt = null;
    } else if (errors.length === 0 && pending) {
      // IG video still processing — try again next cron tick without counting an attempt
      post.status = "scheduled";
      post.nextAttemptAt = new Date(now + 60_000).toISOString();
      post.lastError = "Instagram está procesando el video…";
    } else {
      post.attempts = (post.attempts || 0) + 1;
      post.lastError = errors.join(" · ");
      const canRetry =
        post.attempts < MAX_ATTEMPTS && (opts.autoRetryHardErrors || transientOnly || pending);
      if (canRetry) {
        post.status = "scheduled";
        post.nextAttemptAt = new Date(now + post.attempts * 5 * 60_000).toISOString();
      } else {
        post.status = "failed";
        post.nextAttemptAt = null;
      }
    }
    await savePost(post);
    return post;
  } finally {
    await releaseLock(lockKey);
  }
}

function isDue(p: ScheduledPost, now: number): boolean {
  if (p.status === "scheduled") {
    const t = +new Date(p.nextAttemptAt || p.scheduledAt);
    return Number.isFinite(t) && t <= now;
  }
  if (p.status === "publishing") {
    const l = p.lockedAt ? +new Date(p.lockedAt) : 0;
    return now - l > STALE_PUBLISHING_MS;
  }
  return false;
}

/** Cron entry point: publish every due post (all users) until the deadline. */
export async function runDuePosts(deadline: number) {
  const now = Date.now();
  const members = await listDueMembers();
  const summary = { queued: members.length, due: 0, published: 0, failed: 0, retrying: 0, skipped: 0 };
  for (const { userId, postId } of members) {
    if (Date.now() + 20_000 > deadline) {
      summary.skipped++;
      continue;
    }
    const p = await getPost(userId, postId);
    if (!p) {
      await removeDueMember(userId, postId);
      continue;
    }
    if (p.status !== "scheduled" && p.status !== "publishing") {
      await removeDueMember(userId, postId);
      continue;
    }
    if (!isDue(p, now)) continue;
    summary.due++;
    try {
      const r = await processPost(userId, postId, {
        deadline: Math.min(deadline, Date.now() + 120_000),
        autoRetryHardErrors: true,
      });
      if (r?.status === "published") summary.published++;
      else if (r?.status === "failed") summary.failed++;
      else summary.retrying++;
    } catch (e) {
      summary.failed++;
      console.error("[cron/publish] post", postId, e);
    }
  }
  return summary;
}
