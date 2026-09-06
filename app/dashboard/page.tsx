"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import {
  leadSourceChartData,
  pipelineChartData,
} from "@/lib/seed";
import { useStore } from "@/store/useStore";

const COLORS = ["#6366f1", "#818cf8", "#34d399", "#fbbf24", "#a78bfa", "#f87171"];

export default function DashboardPage() {
  const language = useStore((s) => s.settings.language);
  const contacts = useStore((s) => s.contacts);
  const opportunities = useStore((s) => s.opportunities);
  const appointments = useStore((s) => s.appointments);
  const activity = useStore((s) => s.activity);

  const openDeals = opportunities.filter((o) => !["won", "lost"].includes(o.stage));
  const revenue = opportunities
    .filter((o) => o.stage === "won")
    .reduce((sum, o) => sum + o.value, 0);

  const kpis = [
    {
      label: t(language, "totalContacts"),
      value: contacts.length.toLocaleString(),
      icon: Users,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: t(language, "openDeals"),
      value: String(openDeals.length),
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: t(language, "revenue"),
      value: `$${revenue.toLocaleString()}`,
      icon: DollarSign,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: t(language, "appointments"),
      value: String(appointments.length),
      icon: Calendar,
      tone: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{t(language, "dashboard")}</h1>
        <p className="text-sm text-slate-500">Overview of your pipeline and activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-450 text-slate-500">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">{k.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t(language, "pipelineOverview")}
          </h2>
          <div className="h-64">
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

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t(language, "leadSources")}
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadSourceChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {leadSourceChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {t(language, "recentActivity")}
        </h2>
        <ul className="divide-y divide-slate-100">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-700">{a.text}</span>
              <span className="shrink-0 text-xs text-slate-400">{a.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
