"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, MessageCircle, MessageSquare, Phone, Send } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Conversation } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const channelIcon = {
  sms: MessageSquare,
  email: Mail,
  facebook: MessageCircle,
  whatsapp: Phone,
};

export default function ConversationsPage() {
  const language = useStore((s) => s.settings.language);
  const conversations = useStore((s) => s.conversations);
  const sendMessage = useStore((s) => s.sendMessage);
  const markRead = useStore((s) => s.markRead);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const list = useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
    return filter === "unread" ? sorted.filter((c) => c.unread > 0) : sorted;
  }, [conversations, filter]);

  const selected: Conversation | undefined =
    conversations.find((c) => c.id === selectedId) || list[0];

  useEffect(() => {
    if (selected && selected.unread > 0) markRead(selected.id);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    sendMessage(selected.id, draft.trim());
    setDraft("");
  }

  function pickConversation(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:h-[calc(100dvh-7.5rem)]">
      <div
        className={clsx(
          "flex w-full flex-col border-r border-slate-200 md:max-w-[320px] md:shrink-0",
          mobileShowThread ? "hidden md:flex" : "flex"
        )}
      >
        <div className="border-b border-slate-200 p-3">
          <h1 className="text-lg font-semibold text-slate-800">
            {t(language, "conversations")}
          </h1>
          <div className="mt-2 flex gap-1">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "min-h-[36px] rounded-md px-2.5 py-1 text-xs font-medium",
                  filter === f
                    ? "bg-[var(--brand)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {t(language, f === "all" ? "all" : "unread")}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.map((c) => {
            const Icon = channelIcon[c.channel];
            const active = selected?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => pickConversation(c.id)}
                  className={clsx(
                    "flex min-h-[64px] w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50",
                    active && "bg-sky-50"
                  )}
                >
                  <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {c.contactName}
                      </span>
                      {c.unread > 0 && (
                        <span className="rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{c.lastMessage}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                      {c.channel} · {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-400">{t(language, "noResults")}</li>
          )}
        </ul>
      </div>

      <div
        className={clsx(
          "min-w-0 flex-1 flex-col",
          mobileShowThread ? "flex" : "hidden md:flex"
        )}
      >
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={() => setMobileShowThread(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label={t(language, "back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-slate-800">{selected.contactName}</h2>
                <p className="text-xs capitalize text-slate-500">{selected.channel}</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-3 sm:p-4">
              {selected.messages.map((m) => (
                <div
                  key={m.id}
                  className={clsx("flex", m.fromMe ? "justify-end" : "justify-start")}
                >
                  <div
                    className={clsx(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
                      m.fromMe
                        ? "bg-[var(--brand)] text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <p className="break-words">{m.body}</p>
                    <p
                      className={clsx(
                        "mt-1 text-[10px]",
                        m.fromMe ? "text-white/70" : "text-slate-400"
                      )}
                    >
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={onSend} className="flex gap-2 border-t border-slate-200 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t(language, "typeMessage")}
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
              />
              <button
                type="submit"
                className="brand-bg inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white sm:px-4"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t(language, "send")}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            {t(language, "noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
