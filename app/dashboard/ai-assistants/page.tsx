"use client";

import { Bot, MessageSquare, Phone, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const bots = [
  {
    name: "SMS Concierge",
    channel: "SMS",
    status: "Active",
    conversations: 428,
    icon: MessageSquare,
  },
  {
    name: "Email Closer",
    channel: "Email",
    status: "Active",
    conversations: 192,
    icon: Sparkles,
  },
  {
    name: "Voice Receptionist",
    channel: "Phone",
    status: "Paused",
    conversations: 64,
    icon: Phone,
  },
  {
    name: "Website Chat Bot",
    channel: "Web",
    status: "Active",
    conversations: 891,
    icon: Bot,
  },
];

export default function AIAssistantsPage() {
  const language = useStore((s) => s.settings.language);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "aiAssistants")}
        </h1>
        <p className="text-sm text-slate-500">Demo AI bots for SMS, email, and calling</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {bots.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.name}
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
                  {b.status}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-800">{b.name}</h3>
              <p className="text-xs text-slate-500">{b.channel}</p>
              <p className="mt-3 text-sm text-slate-600">
                <span className="text-lg font-semibold text-slate-800">
                  {b.conversations}
                </span>{" "}
                conversations
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
