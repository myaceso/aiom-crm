"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { t } from "@/lib/i18n";
import {
  leadSourceChartData,
  pipelineChartData,
  revenueTrendData,
} from "@/lib/seed";
import { useStore } from "@/store/useStore";

export default function ReportingPage() {
  const language = useStore((s) => s.settings.language);
  const opportunities = useStore((s) => s.opportunities);
  const contacts = useStore((s) => s.contacts);

  const wonValue = opportunities
    .filter((o) => o.stage === "won")
    .reduce((s, o) => s + o.value, 0);
  const pipelineValue = opportunities
    .filter((o) => !["won", "lost"].includes(o.stage))
    .reduce((s, o) => s + o.value, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{t(language, "reporting")}</h1>
        <p className="text-sm text-slate-500">Analytics snapshot for this demo account</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Won revenue", value: `$${wonValue.toLocaleString()}` },
          { label: "Open pipeline", value: `$${pipelineValue.toLocaleString()}` },
          { label: "Contacts", value: contacts.length.toLocaleString() },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Revenue & leads trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" fill="url(#rev)" />
                <Line type="monotone" dataKey="leads" stroke="#34d399" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(language, "pipelineOverview")}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(language, "leadSources")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadSourceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
