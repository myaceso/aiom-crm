"use client";

import {
  CircleHelp,
  MonitorPlay,
  Users,
  Youtube,
  ThumbsUp,
  Hand,
  Receipt,
} from "lucide-react";
import Logo from "@/components/Logo";

const links = [
  { icon: CircleHelp, text: "Click here to submit a support request", hot: false },
  { icon: MonitorPlay, text: "Click here to attend Vegas Mastermind", hot: false },
  { icon: Users, text: "Click here to import contacts", hot: false },
  { icon: Youtube, text: "Go High Level YouTube Channel for Support", hot: false },
  { icon: ThumbsUp, text: "Click here if you want unlimited 1 on 1 support", hot: true },
  { icon: Hand, text: "Click here to partner with us & make 90% commission", hot: false },
  { icon: Receipt, text: "Click here to attend our Shark Retreat", hot: false },
];

export default function StartHerePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <div className="flex flex-col items-center text-center">
        <Logo className="scale-125" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          enone Software Dashboard
        </h1>
      </div>

      <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="bg-[#1a1030] px-4 py-3 text-sm font-semibold text-white">
            Software Walkthrough Video
          </div>
          <div className="relative aspect-video bg-slate-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3a5f] to-[#0f172a] p-6 text-center">
              <MonitorPlay className="h-14 w-14 text-white/80" />
              <p className="text-sm font-medium text-white">
                Welcome walkthrough · 17:53
              </p>
              <p className="max-w-xs text-xs text-white/60">
                Demo video placeholder — watch how to use contacts, pipelines,
                calendars, and automations.
              </p>
              <button className="mt-2 rounded-full bg-[#f97316] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600">
                Play walkthrough
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Important Links</h2>
          <ul className="space-y-3">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <li key={l.text}>
                  <a
                    href="#"
                    className={`flex items-start gap-3 text-sm hover:underline ${
                      l.hot ? "font-semibold text-[#f97316]" : "text-slate-700"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#f97316]" />
                    <span>{l.text}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f] text-white shadow-lg hover:bg-[#152a45]"
          title="Support chat"
        >
          <CircleHelp className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
