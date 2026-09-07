"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plug, CheckCircle2, Send } from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

export default function TelegramPage() {
  const language = useStore((s) => s.settings.language);
  const tg = useStore((s) => s.integrations.telegram);
  const messagingSends = useStore((s) => s.messagingSends);
  const addMessagingSend = useStore((s) => s.addMessagingSend);
  const showToast = useStore((s) => s.showToast);

  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!prefilled && tg?.defaultChatId && !to) {
      setTo(tg.defaultChatId);
      setPrefilled(true);
    }
  }, [tg?.defaultChatId, to, prefilled]);

  const recent = useMemo(
    () => (messagingSends || []).filter((m) => m.channel === "telegram").slice(0, 20),
    [messagingSends]
  );

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!tg?.connected) {
      showToast(t(language, "connectTelegramRequired"));
      return;
    }
    const chatId = to.trim() || (tg.defaultChatId || "").trim();
    if (!chatId || !body.trim()) {
      showToast(t(language, "requiredFields"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: chatId,
          body: body.trim(),
          settings: tg,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: string }).error || t(language, "sendFailed");
        addMessagingSend({
          channel: "telegram",
          to: chatId,
          body: body.trim(),
          status: "failed",
          error: err,
        });
        showToast(err);
        return;
      }
      addMessagingSend({
        channel: "telegram",
        to: chatId,
        body: body.trim(),
        status: "sent",
        providerId: (data as { id?: string }).id,
      });
      showToast(
        (data as { message?: string }).message || t(language, "sendSuccess")
      );
      setBody("");
    } catch {
      showToast(t(language, "sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t(language, "telegram")}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {tg?.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {t(language, "connectedBadge")}
              </span>
            ) : (
              <span className="text-amber-700">
                {t(language, "connectTelegramRequired")}
              </span>
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

      <form
        onSubmit={onSend}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-700">
          {t(language, "sendMessage")}
        </h2>
        {!tg?.connected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t(language, "connectTelegramRequired")}{" "}
            <Link
              href="/dashboard/integrations"
              className="font-semibold underline"
            >
              {t(language, "goToIntegrations")}
            </Link>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t(language, "recipientTo")}
          </label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={tg?.defaultChatId || "@channel or chat id"}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {t(language, "recipientChatHelp")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t(language, "messageBody")}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t(language, "messagePlaceholder")}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !tg?.connected}
            className="brand-bg inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {t(language, "send")}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {t(language, "recentSends")}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {t(language, "noRecentSends")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {m.to}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      m.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    )}
                  >
                    {m.status === "sent"
                      ? t(language, "sent")
                      : t(language, "sendFailed")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {m.body}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {format(new Date(m.createdAt), "MMM d, HH:mm")}
                  {m.error ? ` · ${m.error}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
