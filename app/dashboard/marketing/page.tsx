"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Music2,
  Building2,
  CheckCircle2,
  ExternalLink,
  Plug,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import type {
  MetaChannel,
  ScheduledPost,
  ScheduledPostStatus,
  SocialNetworkId,
} from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";
import {
  MediaPicker,
  MediaThumb,
  useMediaPreviewHydration,
} from "@/components/marketing/MediaPicker";
import { CreativeStudio } from "@/components/marketing/CreativeStudio";
import { ensureCloudMedia } from "@/lib/mediaCloud";
import { ingestMediaFile } from "@/lib/attachMedia";
import { postText } from "@/lib/creative/copy";
import type { CreativeAsset } from "@/lib/creative/types";
import { normalizeProfileUrl } from "@/lib/social";
import { BufferPanel } from "@/components/marketing/BufferPanel";

const NETWORK_ICONS: Record<SocialNetworkId, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  tiktok: Music2,
  google_business: Building2,
};

const NETWORK_COLORS: Record<SocialNetworkId, string> = {
  facebook: "bg-[#1877F2]",
  instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
  linkedin: "bg-[#0A66C2]",
  x: "bg-[#0f172a]",
  tiktok: "bg-[#0f172a]",
  google_business: "bg-[#4285F4]",
};

const META: MetaChannel[] = ["facebook", "instagram"];
const IG_CAPTION_MAX = 2200;

type Filter = "all" | "scheduled" | "published" | "failed";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MarketingPage() {
  const language = useStore((s) => s.settings.language);
  const connections = useStore((s) => s.socialConnections);
  const localPosts = useStore((s) => s.socialPosts);
  const mediaAssets = useStore((s) => s.mediaAssets);
  const addSocialPost = useStore((s) => s.addSocialPost);
  const addMediaAsset = useStore((s) => s.addMediaAsset);
  const setMediaCloud = useStore((s) => s.setMediaCloud);
  const userId = useStore((s) => s.session?.userId || "");
  const showToast = useStore((s) => s.showToast);
  const L = useCallback((es: string, en: string) => (language === "es" ? es : en), [language]);

  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<MetaChannel[]>([]);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [showLocal, setShowLocal] = useState(false);

  useMediaPreviewHydration();

  const connectedIds = useMemo(
    () => new Set(connections.filter((c) => c.connected).map((c) => c.id)),
    [connections]
  );
  const metaConnected = connectedIds.has("facebook") || connectedIds.has("instagram");
  const mediaById = useMemo(() => new Map(mediaAssets.map((m) => [m.id, m])), [mediaAssets]);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/social/posts", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch {
      /* ignore */
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  // Light polling while something is pending (publishing itself happens on the server via cron)
  const hasPending = posts.some((p) => p.status === "scheduled" || p.status === "publishing");
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void loadPosts(), 30_000);
    return () => clearInterval(id);
  }, [hasPending, loadPosts]);

  function upsert(p: ScheduledPost) {
    setPosts((prev) => [p, ...prev.filter((x) => x.id !== p.id)].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)));
  }

  function toggleChannel(id: MetaChannel) {
    if (!connectedIds.has(id)) {
      showToast(t(language, "channelNotConnected"));
      return;
    }
    setChannels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function useGenerated(item: { file?: File; asset?: CreativeAsset }) {
    const caption = item.asset ? postText(item.asset.caption, item.asset.hashtags) : "";
    if (caption) setBody(caption);
    const attached = (id: string) => {
      setMediaIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
      showToast(L("Listo en el compositor. El texto viral ya está en la publicación.", "Added to the composer. The viral caption is in the post."));
      document.getElementById("post-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (item.asset && item.asset.url.startsWith("https://") && !item.file) {
      const found = mediaAssets.find((m) => m.url === item.asset!.url);
      const id = found?.id || `ai${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
      if (!found) {
        addMediaAsset({
          id,
          kind: item.asset.kind,
          name: item.asset.name,
          size: item.asset.size,
          mime: item.asset.mime,
          createdAt: item.asset.createdAt,
          url: item.asset.url,
          previewUrl: item.asset.kind === "image" ? item.asset.url : undefined,
          durationSec: item.asset.durationSec,
        });
      }
      attached(id);
      return;
    }
    let file = item.file;
    if (!file && item.asset) {
      const response = await fetch(item.asset.url, { credentials: "include" });
      if (!response.ok) throw new Error("fetch");
      const blob = await response.blob();
      file = new File([blob], item.asset.name, { type: item.asset.mime || blob.type });
    }
    if (!file) throw new Error("empty");
    const ingested = await ingestMediaFile(file, userId);
    if (!ingested.ok) throw new Error(ingested.reason);
    addMediaAsset(ingested.asset);
    if (ingested.cloudError) {
      showToast(
        `${L("No se pudo subir a la nube (se reintentará al publicar)", "Cloud upload failed (will retry on publish)")}: ${ingested.cloudError}`
      );
    }
    attached(ingested.asset.id);
  }

  function resetComposer() {
    setBody("");
    setChannels([]);
    setScheduledAt("");
    setMediaIds([]);
    setMode("now");
  }

  const selectedMedia = mediaIds.map((id) => mediaById.get(id)).filter(Boolean);
  const hasVideo = selectedMedia.some((m) => m!.kind === "video");
  const hasImage = selectedMedia.some((m) => m!.kind === "image");

  async function submit() {
    if (!metaConnected) {
      showToast(t(language, "connectRequired"));
      return;
    }
    if (channels.length === 0) {
      showToast(L("Elige Facebook, Instagram o ambos", "Choose Facebook, Instagram or both"));
      return;
    }
    if (!body.trim() && mediaIds.length === 0) {
      showToast(L("Escribe un mensaje o adjunta medios", "Write a post or attach media"));
      return;
    }
    if (channels.includes("instagram") && mediaIds.length === 0) {
      showToast(L("Instagram requiere al menos una imagen o un video", "Instagram requires at least one image or video"));
      return;
    }
    if (channels.includes("instagram") && body.length > IG_CAPTION_MAX) {
      showToast(L(`Máximo ${IG_CAPTION_MAX} caracteres para Instagram`, `Max ${IG_CAPTION_MAX} characters for Instagram`));
      return;
    }
    let when: string | undefined;
    if (mode === "schedule") {
      if (!scheduledAt) {
        showToast(L("Elige fecha y hora", "Pick a date and time"));
        return;
      }
      const d = new Date(scheduledAt);
      if (+d < Date.now() - 60_000) {
        showToast(L("La fecha programada ya pasó", "Scheduled time is in the past"));
        return;
      }
      when = d.toISOString();
    }

    setBusy(true);
    try {
      // 1) Make sure every attachment has a public cloud URL
      const media = [];
      for (const id of mediaIds) {
        const asset = mediaById.get(id);
        if (!asset) continue;
        let url: string | null = null;
        try {
          url = await ensureCloudMedia(asset, userId, setMediaCloud);
        } catch (e) {
          showToast(`${L("Error subiendo", "Upload error")} ${asset.name}: ${e instanceof Error ? e.message : ""}`);
          return;
        }
        if (!url) {
          showToast(
            L(
              `«${asset.name}» solo está guardado en otro dispositivo. Súbelo de nuevo.`,
              `“${asset.name}” only exists on another device. Upload it again.`
            )
          );
          return;
        }
        media.push({ url, kind: asset.kind, mime: asset.mime, name: asset.name, assetId: asset.id });
      }

      // 2) Create the server-side post (published now or queued for the cron)
      const res = await fetch("/api/social/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          channels,
          media,
          publishNow: mode === "now",
          scheduledAt: when,
          lang: language,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { post?: ScheduledPost; error?: string };
      if (!res.ok || !d.post) {
        showToast(d.error || t(language, "publishFailed"));
        return;
      }
      upsert(d.post);
      const p = d.post;
      if (mode === "schedule") {
        showToast(L("Programada: se publicará aunque cierres el navegador", "Scheduled: it will publish even if you close the browser"));
        resetComposer();
      } else if (p.status === "published") {
        showToast(t(language, "publishSuccess"));
        resetComposer();
      } else if (p.status === "failed") {
        const okOnes = META.filter((c) => p.results?.[c]?.ok);
        showToast(
          okOnes.length
            ? `${t(language, "publishPartial")}: ${okOnes.join(", ")} · ${p.lastError || ""}`
            : p.lastError || t(language, "publishFailed")
        );
        if (okOnes.length) resetComposer();
      } else {
        showToast(p.lastError || L("En proceso — se completará en segundo plano", "In progress — will finish in the background"));
        resetComposer();
      }
    } catch {
      showToast(t(language, "publishFailed"));
    } finally {
      setBusy(false);
    }
  }

  function saveDraft() {
    if (!body.trim() && mediaIds.length === 0) {
      showToast(L("Escribe un mensaje o adjunta medios", "Write a post or attach media"));
      return;
    }
    addSocialPost({ body: body.trim(), channels, status: "draft", scheduledAt: null, mediaIds: [...mediaIds] });
    resetComposer();
    showToast(t(language, "draftSuccess"));
  }

  async function rowAction(p: ScheduledPost, action: "retry" | "cancel" | "delete") {
    if (action === "delete" && !confirm(L("¿Quitar de la lista? (No se borra de Facebook/Instagram)", "Remove from list? (Not deleted from Facebook/Instagram)"))) return;
    setRowBusy(p.id);
    try {
      const res = await fetch(`/api/social/posts/${p.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || "Error");
        return;
      }
      if (action === "delete") setPosts((prev) => prev.filter((x) => x.id !== p.id));
      else if (d.post) {
        upsert(d.post);
        if (action === "retry")
          showToast(d.post.status === "published" ? t(language, "publishSuccess") : d.post.lastError || L("Reintento enviado", "Retry sent"));
      }
    } finally {
      setRowBusy(null);
    }
  }

  function loadDraft(id: string) {
    const p = localPosts.find((x) => x.id === id);
    if (!p) return;
    setBody(p.body);
    setChannels(p.channels.filter((c): c is MetaChannel => c === "facebook" || c === "instagram").filter((c) => connectedIds.has(c)));
    setMediaIds((p.mediaIds || []).filter((m) => mediaById.has(m)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const statusLabel: Record<ScheduledPostStatus, string> = {
    scheduled: L("Programada", "Scheduled"),
    publishing: L("Publicando", "Publishing"),
    published: L("Publicada", "Published"),
    failed: L("Fallida", "Failed"),
    cancelled: L("Cancelada", "Cancelled"),
  };

  const filtered = posts.filter((p) =>
    filter === "all"
      ? true
      : filter === "scheduled"
        ? p.status === "scheduled" || p.status === "publishing"
        : filter === "failed"
          ? p.status === "failed" || p.status === "cancelled"
          : p.status === filter
  );
  const counts = {
    all: posts.length,
    scheduled: posts.filter((p) => p.status === "scheduled" || p.status === "publishing").length,
    published: posts.filter((p) => p.status === "published").length,
    failed: posts.filter((p) => p.status === "failed" || p.status === "cancelled").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t(language, "marketing")}</h1>
          <p className="text-sm text-slate-500">
            {L(
              "Publica en Facebook e Instagram, y programa Buffer cada día",
              "Publish to Facebook & Instagram, and schedule Buffer every day"
            )}
          </p>
        </div>
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plug className="h-4 w-4" />
          {t(language, "manageIntegrations")}
        </Link>
      </div>

      {!metaConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {L(
            "Conecta tu Página de Facebook (y tu Instagram profesional) en Integraciones para publicar.",
            "Connect your Facebook Page (and Instagram professional account) in Integrations to publish."
          )}{" "}
          <Link href="/dashboard/integrations" className="font-semibold underline">
            {t(language, "goToIntegrations")}
          </Link>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(language, "socialNetworks")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {connections.map((c) => {
            const Icon = NETWORK_ICONS[c.id];
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={clsx("flex h-10 w-10 items-center justify-center rounded-lg text-white", NETWORK_COLORS[c.id])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
                    {c.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {t(language, "connectedBadge")}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {c.connected ? c.handle || t(language, "connected") : t(language, "notConnected")}
                  </div>
                  {c.connected && c.profileUrl && (
                    <a
                      href={normalizeProfileUrl(c.profileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--brand)] hover:underline"
                    >
                      {t(language, "openProfile")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CreativeStudio language={language} disabled={busy} onUseInPost={useGenerated} />

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          id="post-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="w-full min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 className="text-sm font-semibold text-slate-700">{t(language, "postComposer")}</h2>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("Publicar en", "Publish to")}
            </label>
            <div className="flex flex-wrap gap-2">
              {META.map((id) => {
                const Icon = NETWORK_ICONS[id];
                const active = channels.includes(id);
                const disabled = !connectedIds.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleChannel(id)}
                    className={clsx(
                      "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
                      disabled && "cursor-not-allowed opacity-40",
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {id === "facebook" ? "Facebook" : "Instagram"}
                    {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
              {connectedIds.has("facebook") && connectedIds.has("instagram") && (
                <button
                  type="button"
                  onClick={() => setChannels(channels.length === 2 ? [] : ["facebook", "instagram"])}
                  className="min-h-[36px] rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  {channels.length === 2 ? L("Quitar ambas", "Clear") : L("Ambas", "Both")}
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {L(
                "LinkedIn, X, TikTok y Google Business requieren apps OAuth (aún no disponibles).",
                "LinkedIn, X, TikTok and Google Business need OAuth apps (not available yet)."
              )}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{t(language, "postBody")}</label>
              <span
                className={clsx(
                  "text-[11px]",
                  channels.includes("instagram") && body.length > IG_CAPTION_MAX ? "font-semibold text-red-600" : "text-slate-400"
                )}
              >
                {body.length}
                {channels.includes("instagram") ? ` / ${IG_CAPTION_MAX}` : ""}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              placeholder={L("¿Qué quieres publicar?", "What do you want to share?")}
            />
          </div>

          <MediaPicker language={language} selectedIds={mediaIds} onChange={setMediaIds} disabled={busy} />

          {(channels.includes("instagram") && mediaIds.length === 0) || (hasVideo && hasImage && channels.includes("facebook")) ? (
            <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {channels.includes("instagram") && mediaIds.length === 0
                  ? L("Instagram necesita al menos una imagen o video.", "Instagram needs at least one image or video.")
                  : L(
                      "Facebook no mezcla video e imágenes: se publicará solo el video en Facebook (Instagram hará un carrusel).",
                      "Facebook can't mix video and images: only the video is posted to Facebook (Instagram makes a carousel)."
                    )}
              </span>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("¿Cuándo?", "When?")}
            </label>
            <div className="mb-2 inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
              {(["now", "schedule"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "schedule" && !scheduledAt) setScheduledAt(toLocalInput(new Date(Date.now() + 60 * 60_000)));
                  }}
                  className={clsx(
                    "min-h-[34px] rounded-md px-3 py-1 font-medium",
                    mode === m ? "brand-bg text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {m === "now" ? L("Publicar ahora", "Publish now") : L("Programar", "Schedule")}
                </button>
              ))}
            </div>
            {mode === "schedule" && (
              <>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={toLocalInput(new Date())}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {L(
                    "Hora de este dispositivo. El servidor la publica (±5 min) aunque cierres el navegador.",
                    "This device's time. The server publishes it (±5 min) even with the browser closed."
                  )}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="min-h-[40px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 sm:w-auto"
            >
              {t(language, "saveDraft")}
            </button>
            <button
              type="submit"
              disabled={busy || !metaConnected}
              className="brand-bg inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy
                ? mode === "now"
                  ? L("Publicando…", "Publishing…")
                  : L("Programando…", "Scheduling…")
                : mode === "now"
                  ? L("Publicar ahora", "Publish now")
                  : L("Programar publicación", "Schedule post")}
            </button>
          </div>
        </form>

        <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">{t(language, "scheduledPosts")}</h2>
            <button
              type="button"
              onClick={() => void loadPosts()}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {L("Actualizar", "Refresh")}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", "scheduled", "published", "failed"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {f === "all"
                  ? L("Todas", "All")
                  : f === "scheduled"
                    ? L("Programadas", "Scheduled")
                    : f === "published"
                      ? L("Publicadas", "Published")
                      : L("Fallidas", "Failed")}{" "}
                ({counts[f]})
              </button>
            ))}
          </div>

          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id} className="py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      p.status === "published" && "bg-emerald-50 text-emerald-700",
                      p.status === "scheduled" && "bg-amber-50 text-amber-700",
                      p.status === "publishing" && "bg-blue-50 text-blue-700",
                      p.status === "failed" && "bg-red-50 text-red-700",
                      p.status === "cancelled" && "bg-slate-100 text-slate-500"
                    )}
                  >
                    {p.status === "publishing" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {p.status === "scheduled" && <Clock className="h-3 w-3" />}
                    {statusLabel[p.status]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {p.publishedAt
                      ? format(new Date(p.publishedAt), "MMM d, HH:mm")
                      : format(new Date(p.scheduledAt), "MMM d, HH:mm")}
                  </span>
                  {p.attempts > 0 && (
                    <span className="text-[10px] text-slate-400">
                      {L("intentos", "attempts")}: {p.attempts}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {(p.status === "failed" || p.status === "cancelled" || (p.status === "scheduled" && p.lastError)) && (
                      <button
                        type="button"
                        disabled={rowBusy === p.id}
                        onClick={() => void rowAction(p, "retry")}
                        title={L("Reintentar ahora", "Retry now")}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {rowBusy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        {L("Reintentar", "Retry")}
                      </button>
                    )}
                    {p.status === "scheduled" && (
                      <button
                        type="button"
                        disabled={rowBusy === p.id}
                        onClick={() => void rowAction(p, "cancel")}
                        title={L("Cancelar", "Cancel")}
                        className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {p.status !== "publishing" && (
                      <button
                        type="button"
                        disabled={rowBusy === p.id}
                        onClick={() => void rowAction(p, "delete")}
                        title={L("Quitar de la lista", "Remove from list")}
                        className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {p.body && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{p.body}</p>}
                {p.media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.media.map((m, i) =>
                      m.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={m.url} alt={m.name} className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                      ) : (
                        <video key={i} src={`${m.url}#t=0.1`} muted preload="metadata" className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                      )
                    )}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.channels.map((ch) => {
                    const Icon = NETWORK_ICONS[ch];
                    const r = p.results?.[ch];
                    return (
                      <span
                        key={ch}
                        title={r?.error || ""}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                          r?.ok ? "bg-emerald-50 text-emerald-700" : r?.error ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {ch === "facebook" ? "Facebook" : "Instagram"}
                        {r?.ok && <CheckCircle2 className="h-3 w-3" />}
                        {r?.ok && r.permalink && (
                          <a href={r.permalink} target="_blank" rel="noreferrer" className="underline">
                            {L("ver", "view")}
                          </a>
                        )}
                        {r?.ok && !r.permalink && r.id && <span className="opacity-60">#{r.id}</span>}
                      </span>
                    );
                  })}
                </div>
                {p.lastError && p.status !== "published" && (
                  <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-red-600">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {p.lastError}
                      {p.status === "scheduled" && p.nextAttemptAt && (
                        <span className="text-slate-500">
                          {" "}
                          · {L("reintento automático", "auto-retry")} {format(new Date(p.nextAttemptAt), "HH:mm")}
                        </span>
                      )}
                    </span>
                  </p>
                )}
              </li>
            ))}
            {!loadingPosts && filtered.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">
                {L("Aún no hay publicaciones", "No posts yet")}
              </li>
            )}
            {loadingPosts && (
              <li className="py-6 text-center text-sm text-slate-400">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </li>
            )}
          </ul>

          {localPosts.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowLocal((v) => !v)}
                className="text-xs font-semibold text-slate-500 hover:underline"
              >
                {showLocal ? "▾" : "▸"} {L("Borradores e historial anterior", "Drafts & earlier history")} ({localPosts.length})
              </button>
              {showLocal && (
                <ul className="mt-2 divide-y divide-slate-100">
                  {localPosts.map((p) => {
                    const pm = (p.mediaIds || []).map((id) => mediaById.get(id)).filter(Boolean);
                    return (
                      <li key={p.id} className="py-2.5">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            {p.status === "draft" ? t(language, "draft") : L("sin enviar por servidor", "not server-sent")}
                          </span>
                          <span className="text-[11px] text-slate-400">{format(new Date(p.createdAt), "MMM d, HH:mm")}</span>
                          <button
                            type="button"
                            onClick={() => loadDraft(p.id)}
                            className="ml-auto text-[11px] font-semibold text-[var(--brand)] hover:underline"
                          >
                            {L("Usar en el editor", "Load into composer")}
                          </button>
                        </div>
                        {p.body && <p className="text-xs text-slate-600">{p.body}</p>}
                        {pm.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {pm.map((m) => (
                              <MediaThumb key={m!.id} asset={m!} language={language} compact />
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <BufferPanel />
    </div>
  );
}
