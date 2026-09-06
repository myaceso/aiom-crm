"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X, Plug, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import type { SmsCampaignStatus } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const AUDIENCES = [
  "SMS Opt-in",
  "Active Customers",
  "Hot Leads",
  "Newsletter",
  "Upcoming Appointments",
  "All Contacts",
] as const;

const STATUS_KEY: Record<SmsCampaignStatus, "draft" | "scheduled" | "sent"> = {
  draft: "draft",
  scheduled: "scheduled",
  sent: "sent",
};

export default function SmsMarketingPage() {
  const language = useStore((s) => s.settings.language);
  const campaigns = useStore((s) => s.smsCampaigns);
  const addSmsCampaign = useStore((s) => s.addSmsCampaign);
  const sms = useStore((s) => s.integrations.sms);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [status, setStatus] = useState<SmsCampaignStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  const charCount = body.length;
  const segments = Math.max(1, Math.ceil(Math.max(charCount, 1) / 160));
  const smsConnected = sms.connected;

  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + c.sent, 0);
    const delivered = campaigns.reduce((s, c) => s + c.delivered, 0);
    const clicked = campaigns.reduce((s, c) => s + c.clicked, 0);
    return { sent, delivered, clicked };
  }, [campaigns]);

  function reset() {
    setName("");
    setBody("");
    setAudience(AUDIENCES[0]);
    setStatus("draft");
    setScheduledAt("");
    setOpen(false);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      showToast(
        language === "es" ? "Completa nombre y mensaje" : "Name and message required"
      );
      return;
    }
    if (status === "scheduled" && !scheduledAt) {
      showToast(language === "es" ? "Elige fecha y hora" : "Pick a schedule date");
      return;
    }
    if (status === "sent") {
      if (!smsConnected) {
        showToast(t(language, "connectSmsRequired"));
        return;
      }
      setSending(true);
      try {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign: {
              name: name.trim(),
              body: body.trim(),
              audience,
            },
            settings: sms,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast((data as { error?: string }).error || t(language, "sendFailed"));
          return;
        }
        addSmsCampaign({
          name: name.trim(),
          body: body.trim(),
          audience,
          status: "sent",
          scheduledAt: null,
        });
        showToast(
          (data as { message?: string }).message || t(language, "sendSuccess")
        );
        reset();
      } catch {
        showToast(t(language, "sendFailed"));
      } finally {
        setSending(false);
      }
      return;
    }

    addSmsCampaign({
      name: name.trim(),
      body: body.trim(),
      audience,
      status,
      scheduledAt:
        status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
    });
    showToast(
      language === "es" ? "Campaña SMS creada" : "SMS campaign created"
    );
    reset();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t(language, "smsMarketing")}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {smsConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {t(language, "connectedBadge")} · {sms.fromNumber}
              </span>
            ) : (
              <span className="text-amber-700">{t(language, "connectSmsRequired")}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/integrations"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plug className="h-4 w-4" />
            {t(language, "manageIntegrations")}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="brand-bg inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {t(language, "createCampaign")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t(language, "sent"), value: totals.sent.toLocaleString() },
          {
            label: t(language, "deliveryRate"),
            value:
              totals.sent > 0
                ? `${((totals.delivered / totals.sent) * 100).toFixed(1)}%`
                : "—",
          },
          {
            label: t(language, "clickRate"),
            value:
              totals.delivered > 0
                ? `${((totals.clicked / totals.delivered) * 100).toFixed(1)}%`
                : "—",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {t(language, "campaigns")}
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">{t(language, "name")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "audience")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "status")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "sent")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "clickRate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const ctr =
                c.delivered > 0
                  ? `${((c.clicked / c.delivered) * 100).toFixed(1)}%`
                  : "—";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      {c.body}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.audience}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        c.status === "sent" && "bg-emerald-50 text-emerald-700",
                        c.status === "scheduled" && "bg-amber-50 text-amber-700",
                        c.status === "draft" && "bg-slate-100 text-slate-600"
                      )}
                    >
                      {t(language, STATUS_KEY[c.status])}
                    </span>
                    {c.scheduledAt && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        {format(new Date(c.scheduledAt), "MMM d, HH:mm")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.sent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{ctr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={onCreate}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                {t(language, "createCampaign")}
              </h2>
              <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {!smsConnected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {t(language, "connectSmsRequired")}{" "}
                <Link href="/dashboard/integrations" className="font-semibold underline">
                  {t(language, "goToIntegrations")}
                </Link>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                {t(language, "name")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                {t(language, "audience")}
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-600">
                  {t(language, "messageBody")}
                </label>
                <span
                  className={clsx(
                    "text-xs font-medium",
                    charCount > 160 ? "text-amber-600" : "text-slate-400"
                  )}
                >
                  {charCount}/160 · {segments}{" "}
                  {language === "es" ? "segmento(s)" : "segment(s)"} ·{" "}
                  {t(language, "characters")}
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={480}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                placeholder={
                  language === "es"
                    ? "Máx. 160 caracteres por SMS…"
                    : "Max 160 characters per SMS…"
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "status")}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SmsCampaignStatus)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  <option value="draft">{t(language, "draft")}</option>
                  <option value="scheduled">{t(language, "scheduled")}</option>
                  <option value="sent" disabled={!smsConnected}>
                    {t(language, "sent")}
                    {!smsConnected ? ` (${t(language, "notConnected")})` : ""}
                  </option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "scheduleAt")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={status !== "scheduled"}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none disabled:bg-slate-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              >
                {t(language, "cancel")}
              </button>
              <button
                type="submit"
                disabled={sending || (status === "sent" && !smsConnected)}
                className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {status === "sent" ? t(language, "send") : t(language, "create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
