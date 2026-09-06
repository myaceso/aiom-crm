"use client";

import { t } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const COLS = ["Source","Rating","Reviews","Sentiment","Last activity"] as const;
const ROWS = [
  ["Google", "5.0", "128", "Positive", "2h ago"],
  ["Facebook", "4.8", "64", "Positive", "1d ago"],
  ["Yelp", "4.6", "41", "Neutral", "3d ago"],
  ["Google", "4.0", "—", "Needs reply", "5d ago"],
  ["Facebook", "5.0", "—", "Positive", "1w ago"],
  ["Google", "3.0", "—", "Needs reply", "2w ago"]
] as const;

export default function ReputationPage() {
  const language = useStore((s) => s.settings.language);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "reputation" as DictKey)}
        </h1>
        <p className="text-sm text-slate-500">Demo sample data — read only</p>
      </div>
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
