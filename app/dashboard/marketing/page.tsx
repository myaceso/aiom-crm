"use client";

import { FormEvent, useMemo, useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import type { SocialNetworkId, SocialPostStatus } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";
import {
  MediaPicker,
  MediaThumb,
  useMediaPreviewHydration,
} from "@/components/marketing/MediaPicker";

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

const STATUS_KEY: Record<SocialPostStatus, "draft" | "scheduled" | "published"> = {
  draft: "draft",
  scheduled: "scheduled",
  published: "published",
};

export default function MarketingPage() {
  const language = useStore((s) => s.settings.language);
  const connections = useStore((s) => s.socialConnections);
  const posts = useStore((s) => s.socialPosts);
  const mediaAssets = useStore((s) => s.mediaAssets);
  const addSocialPost = useStore((s) => s.addSocialPost);
  const showToast = useStore((s) => s.showToast);

  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<SocialNetworkId[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  useMediaPreviewHydration();

  const connectedIds = useMemo(
    () => new Set(connections.filter((c) => c.connected).map((c) => c.id)),
    [connections]
  );
  const hasConnected = connectedIds.size > 0;

  const mediaById = useMemo(() => {
    const map = new Map(mediaAssets.map((m) => [m.id, m]));
    return map;
  }, [mediaAssets]);

  function toggleChannel(id: SocialNetworkId) {
    if (!connectedIds.has(id)) return;
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function resetComposer() {
    setBody("");
    setChannels([]);
    setScheduledAt("");
    setMediaIds([]);
  }

  async function submit(status: SocialPostStatus) {
    if (!hasConnected) {
      showToast(t(language, "connectRequired"));
      return;
    }
    if (!body.trim() && mediaIds.length === 0) {
      showToast(language === "es" ? "Escribe un mensaje o adjunta medios" : "Write a post or attach media");
      return;
    }
    if (channels.length === 0) {
      showToast(
        language === "es"
          ? "Selecciona al menos un canal"
          : "Select at least one channel"
      );
      return;
    }
    if (status === "scheduled" && !scheduledAt) {
      showToast(language === "es" ? "Elige fecha y hora" : "Pick a schedule date");
      return;
    }

    const mediaMeta = mediaIds
      .map((id) => mediaById.get(id))
      .filter(Boolean)
      .map((m) => ({
        id: m!.id,
        kind: m!.kind,
        name: m!.name,
        size: m!.size,
        mime: m!.mime,
      }));

    if (status === "published") {
      setPublishing(true);
      try {
        const res = await fetch("/api/social/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: body.trim(),
            channels,
            media: mediaMeta,
            mediaCount: mediaMeta.length,
            connections: connections.map((c) => ({
              id: c.id,
              connected: c.connected,
              handle: c.handle,
              profileUrl: c.profileUrl,
              accessToken: c.accessToken,
            })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(
            (data as { error?: string }).error || t(language, "publishFailed")
          );
          return;
        }
        addSocialPost({
          body: body.trim(),
          channels,
          status: "published",
          scheduledAt: null,
          mediaIds: [...mediaIds],
        });
        resetComposer();
        showToast(t(language, "publishSuccess"));
      } catch {
        showToast(t(language, "publishFailed"));
      } finally {
        setPublishing(false);
      }
      return;
    }

    addSocialPost({
      body: body.trim(),
      channels,
      status,
      scheduledAt:
        status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
      mediaIds: [...mediaIds],
    });
    resetComposer();
    showToast(
      status === "scheduled"
        ? language === "es"
          ? "Publicación programada"
          : "Post scheduled"
        : language === "es"
          ? "Borrador guardado"
          : "Draft saved"
    );
  }

  function onComposer(e: FormEvent) {
    e.preventDefault();
    void submit(scheduledAt ? "scheduled" : "published");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t(language, "marketing")}
          </h1>
          <p className="text-sm text-slate-500">{t(language, "socialNetworks")}</p>
        </div>
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plug className="h-4 w-4" />
          {t(language, "manageIntegrations")}
        </Link>
      </div>

      {!hasConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t(language, "connectRequired")}{" "}
          <Link
            href="/dashboard/integrations"
            className="font-semibold underline"
          >
            {t(language, "goToIntegrations")}
          </Link>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {t(language, "socialNetworks")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {connections.map((c) => {
            const Icon = NETWORK_ICONS[c.id];
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-white",
                    NETWORK_COLORS[c.id]
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {c.name}
                    </div>
                    {c.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {t(language, "connectedBadge")}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {c.connected
                      ? c.handle || t(language, "connected")
                      : t(language, "notConnected")}
                  </div>
                  {c.connected && c.profileUrl && (
                    <a
                      href={c.profileUrl}
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

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={onComposer}
          className="w-full min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 className="text-sm font-semibold text-slate-700">
            {t(language, "postComposer")}
          </h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "channels")}
            </label>
            <div className="flex flex-wrap gap-2">
              {connections.map((c) => {
                const Icon = NETWORK_ICONS[c.id];
                const active = channels.includes(c.id);
                const disabled = !c.connected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleChannel(c.id)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      disabled && "cursor-not-allowed opacity-40",
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "postBody")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              placeholder={
                language === "es"
                  ? "¿Qué quieres publicar?"
                  : "What do you want to share?"
              }
            />
          </div>

          <MediaPicker
            language={language}
            selectedIds={mediaIds}
            onChange={setMediaIds}
            disabled={!hasConnected || publishing}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "scheduleAt")}
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => void submit("draft")}
              disabled={!hasConnected || publishing}
              className="min-h-[40px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 sm:w-auto"
            >
              {t(language, "saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => void submit("scheduled")}
              disabled={!hasConnected || publishing}
              className="min-h-[40px] w-full rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand)] disabled:opacity-40 sm:w-auto"
            >
              {t(language, "schedulePost")}
            </button>
            <button
              type="submit"
              disabled={!hasConnected || publishing}
              className="brand-bg min-h-[40px] w-full rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
            >
              {t(language, "publishNow")}
            </button>
          </div>
        </form>

        <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {t(language, "scheduledPosts")}
          </h2>
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => {
              const postMedia = (p.mediaIds || [])
                .map((id) => mediaById.get(id))
                .filter(Boolean);
              return (
                <li key={p.id} className="py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        p.status === "published" &&
                          "bg-emerald-50 text-emerald-700",
                        p.status === "scheduled" && "bg-amber-50 text-amber-700",
                        p.status === "draft" && "bg-slate-100 text-slate-600"
                      )}
                    >
                      {t(language, STATUS_KEY[p.status])}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {p.publishedAt
                        ? format(new Date(p.publishedAt), "MMM d, HH:mm")
                        : p.scheduledAt
                          ? format(new Date(p.scheduledAt), "MMM d, HH:mm")
                          : format(new Date(p.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                  {p.body && (
                    <p className="text-sm text-slate-700">{p.body}</p>
                  )}
                  {postMedia.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {postMedia.map((m) => (
                        <MediaThumb
                          key={m!.id}
                          asset={m!}
                          language={language}
                          compact
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.channels.map((ch) => {
                      const Icon = NETWORK_ICONS[ch];
                      return (
                        <span
                          key={ch}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          <Icon className="h-3 w-3" />
                          {connections.find((c) => c.id === ch)?.name || ch}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
            {posts.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">
                {t(language, "noResults")}
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
