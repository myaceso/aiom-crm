"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  MessageSquare,
  Phone,
  Sparkles,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const bots = [
  {
    nameKey: "aiBotSms" as const,
    channelKey: "aiChannelSms" as const,
    status: "Active" as const,
    conversations: 428,
    icon: MessageSquare,
  },
  {
    nameKey: "aiBotEmail" as const,
    channelKey: "aiChannelEmail" as const,
    status: "Active" as const,
    conversations: 192,
    icon: Sparkles,
  },
  {
    nameKey: "aiBotVoice" as const,
    channelKey: "aiChannelPhone" as const,
    status: "Paused" as const,
    conversations: 64,
    icon: Phone,
  },
  {
    nameKey: "aiBotWeb" as const,
    channelKey: "aiChannelWeb" as const,
    status: "Active" as const,
    conversations: 891,
    icon: Bot,
  },
];

export default function AIAssistantsPage() {
  const language = useStore((s) => s.settings.language);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "aiAssistants")}
        </h1>
        <p className="text-sm text-slate-500">{t(language, "aiAssistantsSubtitle")}</p>
      </div>

      <Link
        href="/dashboard/ai-assistants/agent"
        className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-5 text-white shadow-md transition hover:shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-100">
              {t(language, "aiPrimaryBadge")}
            </div>
            <h2 className="mt-2 text-lg font-semibold sm:text-xl">
              {t(language, "aiSmartAgent")}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-indigo-100/90">
              {t(language, "aiSmartAgentDesc")}
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition group-hover:bg-indigo-50 sm:self-center">
          {t(language, "aiOpenAgent")}
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          {t(language, "aiDemoBots")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {bots.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.nameKey}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-orange-50 p-2 text-[#f97316]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {b.status === "Active"
                      ? t(language, "aiStatusActive")
                      : t(language, "aiStatusPaused")}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-800">
                  {t(language, b.nameKey)}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(language, b.channelKey)}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  <span className="text-lg font-semibold text-slate-800">
                    {b.conversations}
                  </span>{" "}
                  {t(language, "aiConversationsLabel")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
