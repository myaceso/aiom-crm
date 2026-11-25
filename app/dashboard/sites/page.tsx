"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n";
import { LANDING_BRAND, LANDING_PATH } from "@/lib/landing/config";
import { useStore } from "@/store/useStore";

const COLS = ["Name","Type","Status","URL"] as const;
const ROWS = [
  ["Main Funnel", "Funnel", "Published", "allinone.demo/funnel"],
  ["Contact Form", "Form", "Published", "allinone.demo/form"],
  ["NPS Survey", "Survey", "Draft", "allinone.demo/nps"],
  ["Booking Page", "Calendar", "Published", "allinone.demo/book"],
  ["Agency Site", "Website", "Published", "allinone.demo"],
  ["Lead Magnet PDF", "Funnel", "Published", "allinone.demo/guide"]
] as const;

export default function SitesPage() {
  const language = useStore((s) => s.settings.language);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "sites" as DictKey)}
        </h1>
        <p className="text-sm text-slate-500">{t(language, "sitesLiveBody")}</p>
      </div>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          {t(language, "sitesLiveKicker")}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-800">{LANDING_BRAND}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Funnel · Published · {LANDING_PATH}
            </p>
          </div>
          <Link
            href={LANDING_PATH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[40px] items-center justify-center rounded-md bg-[#0f172a] px-4 text-sm font-semibold text-[#FFC72C]"
          >
            {t(language, "sitesOpenPage")}
          </Link>
        </div>
      </article>
      <p className="text-sm text-slate-500">{t(language, "sitesDemoNote")}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {COLS.map((c) => (
                <th key={c} className="px-4 py-3 font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-slate-700">
                    {String(cell).includes("Paid") || String(cell) === "Active" || String(cell) === "Published" || String(cell) === "Positive" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{cell}</span>
                    ) : String(cell) === "Pending" || String(cell) === "Draft" || String(cell) === "Paused" || String(cell) === "Neutral" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{cell}</span>
                    ) : String(cell) === "Overdue" || String(cell) === "Needs reply" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{cell}</span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
