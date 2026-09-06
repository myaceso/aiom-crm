"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { langLabels, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { useStore } from "@/store/useStore";

export default function SettingsPage() {
  const language = useStore((s) => s.settings.language);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const showToast = useStore((s) => s.showToast);

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [lang, setLang] = useState<Lang>(settings.language);

  function onSave(e: FormEvent) {
    e.preventDefault();
    updateSettings({
      companyName: companyName.trim() || "enone",
      primaryColor: primaryColor || "#6366f1",
      language: lang,
    });
    showToast(t(lang, "saved"));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{t(language, "settings")}</h1>
        <p className="text-sm text-slate-500">Company branding and preferences</p>
      </div>

      <Link
        href="/dashboard/integrations"
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--brand)]/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {t(language, "integrations")}
            </div>
            <div className="text-xs text-slate-500">
              {t(language, "integrationsDesc")}
            </div>
          </div>
        </div>
        <span className="text-xs font-semibold text-[var(--brand)]">
          {t(language, "manageIntegrations")} →
        </span>
      </Link>

      <form
        onSubmit={onSave}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">
            {t(language, "companyName")}
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">
            {t(language, "primaryColor")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white p-1"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 rounded-md border border-slate-200 px-3 py-2.5 text-sm font-mono outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            {["#6366f1", "#4f46e5", "#0f172a", "#10b981", "#f59e0b"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPrimaryColor(c)}
                className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-slate-200"
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">
            {t(language, "language")}
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none"
          >
            {(Object.keys(langLabels) as Lang[]).map((code) => (
              <option key={code} value={code}>
                {langLabels[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="brand-bg rounded-md px-4 py-2.5 text-sm font-semibold text-white"
          >
            {t(language, "save")}
          </button>
        </div>
      </form>
    </div>
  );
}
