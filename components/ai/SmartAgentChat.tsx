"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import { t, type DictKey } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
};

const SUGGEST_KEYS: DictKey[] = [
  "aiSuggestSms",
  "aiSuggestEmail",
  "aiSuggestFollowUp",
  "aiSuggestSocial",
];

export default function SmartAgentChat() {
  const language = useStore((s) => s.settings.language);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(
    () => SUGGEST_KEYS.map((k) => t(language, k)),
    [language]
  );

  async function loadThreads() {
    try {
      const res = await fetch("/api/ai/chat", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setThreads(data.conversations || []);
      setConfigured(!!data.configured);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setDraft("");
    setMobileShowChat(true);
    inputRef.current?.focus();
  }

  async function openThread(id: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/chat?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t(language, "serverError"));
        return;
      }
      setConversationId(data.conversation.id);
      setMessages(
        (data.conversation.messages || []).map(
          (m: { id: string; role: "user" | "assistant"; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })
        )
      );
      setConfigured(!!data.configured);
      setMobileShowChat(true);
    } catch {
      setError(t(language, "serverError"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteThread(id: string) {
    await fetch(`/api/ai/chat?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (conversationId === id) startNewChat();
    void loadThreads();
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    setError(null);
    const userMsg: UiMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 503 && data.error === "ai_not_configured") {
        setConfigured(false);
        setError(t(language, "aiNotConfigured"));
        return;
      }

      if (!res.ok) {
        setError(
          data.message || data.error || t(language, "aiChatError")
        );
        return;
      }

      setConfigured(true);
      setConversationId(data.conversationId);
      if (data.conversation?.messages) {
        setMessages(
          data.conversation.messages.map(
            (m: { id: string; role: "user" | "assistant"; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })
          )
        );
      } else if (data.reply) {
        setMessages([
          ...next,
          {
            id: data.reply.id,
            role: "assistant",
            content: data.reply.content,
          },
        ]);
      }
      void loadThreads();
    } catch {
      setError(t(language, "serverError"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:h-[calc(100dvh-7.5rem)]">
      {/* Thread sidebar */}
      <div
        className={clsx(
          "flex w-full flex-col border-r border-slate-200 bg-slate-50/80 md:max-w-[280px] md:shrink-0",
          mobileShowChat ? "hidden md:flex" : "flex"
        )}
      >
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard/ai-assistants"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[var(--brand)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t(language, "aiBackToAssistants")}
            </Link>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-slate-800">
            {t(language, "aiSmartAgent")}
          </h1>
          <button
            type="button"
            onClick={startNewChat}
            className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-hover)]"
          >
            <Plus className="h-4 w-4" />
            {t(language, "aiNewChat")}
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-slate-400">
              {t(language, "aiNoChats")}
            </li>
          )}
          {threads.map((th) => (
            <li key={th.id} className="group relative mb-1">
              <button
                type="button"
                onClick={() => void openThread(th.id)}
                className={clsx(
                  "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white",
                  conversationId === th.id &&
                    "bg-white shadow-sm ring-1 ring-indigo-100"
                )}
              >
                <div className="truncate text-sm font-medium text-slate-800">
                  {th.title}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">
                  {th.preview}
                </div>
              </button>
              <button
                type="button"
                onClick={() => void deleteThread(th.id)}
                className="absolute right-2 top-2 hidden rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-hover:block"
                aria-label={t(language, "aiDeleteChat")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat pane */}
      <div
        className={clsx(
          "flex min-w-0 flex-1 flex-col",
          mobileShowChat ? "flex" : "hidden md:flex"
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 md:px-4">
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileShowChat(false)}
            aria-label={t(language, "aiChats")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[var(--brand)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">
              {t(language, "aiSmartAgent")}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {t(language, "aiSmartAgentTagline")}
            </div>
          </div>
        </div>

        {configured === false && (
          <div className="mx-3 mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 sm:mx-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t(language, "aiNotConfiguredTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                {t(language, "aiNotConfigured")}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
          {messages.length === 0 && !loading && (
            <div className="mx-auto flex max-w-xl flex-col items-center px-2 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-slate-900 text-white shadow-lg">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">
                {t(language, "aiWelcomeTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t(language, "aiWelcomeBody")}
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage(s)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={clsx(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                  m.role === "user"
                    ? "bg-[var(--brand)] text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" />
                {t(language, "aiThinking")}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-slate-200 bg-white p-3 sm:p-4"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)]">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={t(language, "aiComposerPlaceholder")}
              className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t(language, "send")}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            {t(language, "aiDisclaimer")}
          </p>
        </form>
      </div>
    </div>
  );
}
