"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Music2,
  Building2,
  CheckCircle2,
  Link2Off,
} from "lucide-react";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import type { SocialNetworkId, SocialPostStatus } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const NETWORK_ICONS: Record<
  SocialNetworkId,
  typeof Facebook
> = {
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
  const toggleSocialConnection = useStore((s) => s.toggleSocialConnection);
  const addSocialPost = useStore((s) => s.addSocialPost);
  const showToast = useStore((s) => s.showToast);

  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<SocialNetworkId[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");

  const connectedIds = useMemo(
    () => new Set(connections.filter((c) => c.connected).map((c) => c.id)),
    [connections]
  );

  function toggleChannel(id: SocialNetworkId) {
    if (!connectedIds.has(id)) return;
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function submit(status: SocialPostStatus) {
    if (!body.trim()) {
      showToast(language === "es" ? "Escribe un mensaje" : "Write a post first");
      return;
    }
    if (channels.length === 0) {
      showToast(language === "es" ? "Selecciona al menos un canal" : "Select at least one channel");
      return;
    }
    if (status === "scheduled" && !scheduledAt) {
      showToast(language === "es" ? "Elige fecha y hora" : "Pick a schedule date");
      return;
    }
    addSocialPost({
      body: body.trim(),
      channels,
      status,
      scheduledAt: status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
    });
    setBody("");
    setChannels([]);
    setScheduledAt("");
    const msg =
      status === "published"
        ? language === "es"
          ? "Publicación publicada (demo)"
          : "Post published (demo)"
        : status === "scheduled"
          ? language === "es"
            ? "Publicación programada"
            : "Post scheduled"
          : language === "es"
            ? "Borrador guardado"
            : "Draft saved";
    showToast(msg);
  }

  function onComposer(e: FormEvent) {
    e.preventDefault();
    submit(scheduledAt ? "scheduled" : "published");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "marketing")}
        </h1>
        <p className="text-sm text-slate-500">
          {t(language, "socialNetworks")} — {language === "es" ? "solo demo, sin APIs reales" : "mock only, no real APIs"}
        </p>
      </div>

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
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {c.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {c.connected
                      ? c.handle || t(language, "connected")
                      : t(language, "notConnected")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleSocialConnection(c.id);
                    showToast(
                      c.connected
                        ? language === "es"
                          ? `${c.name} desconectado`
                          : `${c.name} disconnected`
                        : language === "es"
                          ? `${c.name} conectado`
                          : `${c.name} connected`
                    );
                  }}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    c.connected
                      ? "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      : "brand-bg text-white"
                  )}
                >
                  {c.connected ? (
                    <>
                      <Link2Off className="h-3.5 w-3.5" />
                      {t(language, "disconnect")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t(language, "connect")}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={onComposer}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => submit("draft")}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t(language, "saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => submit("scheduled")}
              className="rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand)]"
            >
              {t(language, "schedulePost")}
            </button>
            <button
              type="submit"
              className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white"
            >
              {t(language, "publishNow")}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {t(language, "scheduledPosts")}
          </h2>
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => (
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
                <p className="text-sm text-slate-700">{p.body}</p>
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
            ))}
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
