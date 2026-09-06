"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";
import { t } from "@/lib/i18n";
import type { EmailCampaignStatus } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const AUDIENCES = [
  "New Leads (30d)",
  "Newsletter",
  "Hot Leads",
  "All Contacts",
  "VIP",
  "Inactive",
] as const;

const STATUS_KEY: Record<EmailCampaignStatus, "draft" | "scheduled" | "sent"> = {
  draft: "draft",
  scheduled: "scheduled",
  sent: "sent",
};

export default function EmailMarketingPage() {
  const language = useStore((s) => s.settings.language);
  const campaigns = useStore((s) => s.emailCampaigns);
  const templates = useStore((s) => s.emailTemplates);
  const addEmailCampaign = useStore((s) => s.addEmailCampaign);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState<EmailCampaignStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");

  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + c.sent, 0);
    const opened = campaigns.reduce((s, c) => s + c.opened, 0);
    const clicked = campaigns.reduce((s, c) => s + c.clicked, 0);
    return { sent, opened, clicked };
  }, [campaigns]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setName(tpl.name);
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  function reset() {
    setName("");
    setSubject("");
    setBody("");
    setAudience(AUDIENCES[0]);
    setTemplateId("");
    setStatus("draft");
    setScheduledAt("");
    setOpen(false);
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) {
      showToast(
        language === "es"
          ? "Completa nombre, asunto y cuerpo"
          : "Name, subject and body required"
      );
      return;
    }
    if (status === "scheduled" && !scheduledAt) {
      showToast(language === "es" ? "Elige fecha y hora" : "Pick a schedule date");
      return;
    }
    addEmailCampaign({
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      audience,
      templateId: templateId || undefined,
      status,
      scheduledAt: status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
    });
    showToast(
      language === "es"
        ? "Campaña de email creada (demo)"
        : "Email campaign created (demo)"
    );
    reset();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t(language, "emailMarketing")}
          </h1>
          <p className="text-sm text-slate-500">
            {t(language, "mockStats")} — {language === "es" ? "sin APIs reales" : "no real APIs"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="brand-bg inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {t(language, "createCampaign")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t(language, "sent"), value: totals.sent.toLocaleString() },
          {
            label: t(language, "openRate"),
            value:
              totals.sent > 0
                ? `${((totals.opened / totals.sent) * 100).toFixed(1)}%`
                : "—",
          },
          {
            label: t(language, "clickRate"),
            value:
              totals.sent > 0
                ? `${((totals.clicked / totals.sent) * 100).toFixed(1)}%`
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {t(language, "templates")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                setOpen(true);
                applyTemplate(tpl.id);
                showToast(
                  language === "es"
                    ? `Plantilla «${tpl.name}» aplicada`
                    : `Template “${tpl.name}” applied`
                );
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/5"
            >
              <div className="text-sm font-semibold text-slate-800">{tpl.name}</div>
              <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                {tpl.subject}
              </div>
              <div className="mt-2 text-[11px] font-medium text-[var(--brand)]">
                {t(language, "useTemplate")}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {t(language, "campaigns")}
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">{t(language, "name")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "subject")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "audience")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "status")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "openRate")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "clickRate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const openRate =
                c.sent > 0 ? `${((c.opened / c.sent) * 100).toFixed(1)}%` : "—";
              const clickRate =
                c.sent > 0 ? `${((c.clicked / c.sent) * 100).toFixed(1)}%` : "—";
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.subject}</td>
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
                  <td className="px-4 py-3 text-slate-700">{openRate}</td>
                  <td className="px-4 py-3 text-slate-700">{clickRate}</td>
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
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                {t(language, "createCampaign")}
              </h2>
              <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                {t(language, "templates")}
              </label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
              >
                <option value="">
                  {language === "es" ? "Sin plantilla" : "No template"}
                </option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
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
                {t(language, "subject")}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                {t(language, "messageBody")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "status")}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EmailCampaignStatus)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  <option value="draft">{t(language, "draft")}</option>
                  <option value="scheduled">{t(language, "scheduled")}</option>
                  <option value="sent">{t(language, "sent")}</option>
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
                className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white"
              >
                {t(language, "create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
