"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Music2,
  Building2,
  CheckCircle2,
  ExternalLink,
  Plug,
  ShieldAlert,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { EmailProvider, SocialNetworkId } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const NETWORK_ICONS: Record<SocialNetworkId, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  tiktok: Music2,
  google_business: Building2,
};

const NETWORK_COLORS: Record<SocialNetworkId, string> = {
  facebook: "bg-[#1877F2]",
  instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
  linkedin: "bg-[#0A66C2]",
  x: "bg-[#0f172a]",
  tiktok: "bg-[#0f172a]",
  google_business: "bg-[#4285F4]",
};

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function IntegrationsPage() {
  const language = useStore((s) => s.settings.language);
  const connections = useStore((s) => s.socialConnections);
  const connectSocial = useStore((s) => s.connectSocial);
  const disconnectSocial = useStore((s) => s.disconnectSocial);
  const updateSocialDraft = useStore((s) => s.updateSocialDraft);
  const integrations = useStore((s) => s.integrations);
  const connectSms = useStore((s) => s.connectSms);
  const disconnectSms = useStore((s) => s.disconnectSms);
  const connectEmail = useStore((s) => s.connectEmail);
  const disconnectEmail = useStore((s) => s.disconnectEmail);
  const showToast = useStore((s) => s.showToast);

  const [smsForm, setSmsForm] = useState({
    accountSid: integrations.sms.accountSid,
    authToken: integrations.sms.authToken,
    fromNumber: integrations.sms.fromNumber,
  });
  const [emailForm, setEmailForm] = useState({
    provider: integrations.email.provider as EmailProvider,
    apiKey: integrations.email.apiKey,
    fromEmail: integrations.email.fromEmail,
    fromName: integrations.email.fromName,
  });
  const [testing, setTesting] = useState<"sms" | "email" | null>(null);

  const connectedCount = useMemo(
    () => connections.filter((c) => c.connected).length,
    [connections]
  );

  function onConnectSocial(id: SocialNetworkId) {
    const c = connections.find((x) => x.id === id);
    if (!c) return;
    if (!c.handle?.trim() && !c.profileUrl?.trim()) {
      showToast(t(language, "requiredFields"));
      return;
    }
    connectSocial(id, {
      handle: c.handle,
      profileUrl: c.profileUrl,
      accessToken: c.accessToken,
    });
    showToast(
      language === "es" ? `${c.name} conectado` : `${c.name} connected`
    );
  }

  async function testSms() {
    if (
      !smsForm.accountSid.trim() ||
      !smsForm.authToken.trim() ||
      !smsForm.fromNumber.trim()
    ) {
      showToast(t(language, "requiredFields"));
      return;
    }
    if (!E164.test(smsForm.fromNumber.trim())) {
      showToast(t(language, "invalidPhone"));
      return;
    }
    setTesting("sms");
    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smsForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t(language, "testFail"));
        return;
      }
      showToast(data.message || t(language, "testOk"));
    } catch {
      showToast(t(language, "testFail"));
    } finally {
      setTesting(null);
    }
  }

  function onConnectSms() {
    if (
      !smsForm.accountSid.trim() ||
      !smsForm.authToken.trim() ||
      !smsForm.fromNumber.trim()
    ) {
      showToast(t(language, "requiredFields"));
      return;
    }
    if (!E164.test(smsForm.fromNumber.trim())) {
      showToast(t(language, "invalidPhone"));
      return;
    }
    connectSms(smsForm);
    showToast(
      language === "es" ? "SMS conectado" : "SMS connected"
    );
  }

  async function testEmail() {
    if (
      !emailForm.apiKey.trim() ||
      !emailForm.fromEmail.trim() ||
      !emailForm.fromName.trim()
    ) {
      showToast(t(language, "requiredFields"));
      return;
    }
    if (!EMAIL_RE.test(emailForm.fromEmail.trim())) {
      showToast(t(language, "invalidEmail"));
      return;
    }
    setTesting("email");
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t(language, "testFail"));
        return;
      }
      showToast(data.message || t(language, "testOk"));
    } catch {
      showToast(t(language, "testFail"));
    } finally {
      setTesting(null);
    }
  }

  function onConnectEmail() {
    if (
      !emailForm.apiKey.trim() ||
      !emailForm.fromEmail.trim() ||
      !emailForm.fromName.trim()
    ) {
      showToast(t(language, "requiredFields"));
      return;
    }
    if (!EMAIL_RE.test(emailForm.fromEmail.trim())) {
      showToast(t(language, "invalidEmail"));
      return;
    }
    connectEmail(emailForm);
    showToast(
      language === "es" ? "Email conectado" : "Email connected"
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "integrations")}
        </h1>
        <p className="text-sm text-slate-500">{t(language, "integrationsDesc")}</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t(language, "securityNote")}</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            {t(language, "socialNetworks")}
          </h2>
          <span className="text-xs text-slate-500">
            {connectedCount}/{connections.length} {t(language, "connected")}
          </span>
        </div>
        <div className="space-y-3">
          {connections.map((c) => {
            const Icon = NETWORK_ICONS[c.id];
            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-lg text-white",
                      NETWORK_COLORS[c.id]
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {c.name}
                      </span>
                      {c.connected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {t(language, "connectedBadge")}
                        </span>
                      )}
                    </div>
                    {c.connected && c.profileUrl ? (
                      <a
                        href={c.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
                      >
                        {t(language, "openProfile")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {c.connected
                          ? c.handle || t(language, "connected")
                          : t(language, "notConnected")}
                      </p>
                    )}
                  </div>
                  {c.connected ? (
                    <button
                      type="button"
                      onClick={() => {
                        disconnectSocial(c.id);
                        showToast(
                          language === "es"
                            ? `${c.name} desconectado`
                            : `${c.name} disconnected`
                        );
                      }}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t(language, "disconnect")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onConnectSocial(c.id)}
                      className="brand-bg rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {t(language, "connect")}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t(language, "handle")}
                    </label>
                    <input
                      value={c.handle || ""}
                      disabled={c.connected}
                      onChange={(e) =>
                        updateSocialDraft(c.id, { handle: e.target.value })
                      }
                      placeholder="@enone"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t(language, "profileUrl")}
                    </label>
                    <input
                      value={c.profileUrl || ""}
                      disabled={c.connected}
                      onChange={(e) =>
                        updateSocialDraft(c.id, { profileUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t(language, "accessTokenOptional")}
                    </label>
                    <input
                      type="password"
                      value={c.accessToken || ""}
                      disabled={c.connected}
                      onChange={(e) =>
                        updateSocialDraft(c.id, { accessToken: e.target.value })
                      }
                      autoComplete="off"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">
              {t(language, "smsSettings")}
            </h2>
            {integrations.sms.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {t(language, "connectedBadge")}
              </span>
            )}
          </div>
          <Link
            href="/dashboard/sms-marketing"
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            {t(language, "smsMarketing")} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "accountSid")}
            </label>
            <input
              value={smsForm.accountSid}
              disabled={integrations.sms.connected}
              onChange={(e) =>
                setSmsForm((f) => ({ ...f, accountSid: e.target.value }))
              }
              placeholder="ACxxxxxxxx"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "authToken")}
            </label>
            <input
              type="password"
              value={smsForm.authToken}
              disabled={integrations.sms.connected}
              onChange={(e) =>
                setSmsForm((f) => ({ ...f, authToken: e.target.value }))
              }
              autoComplete="off"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "fromPhone")}
            </label>
            <input
              value={smsForm.fromNumber}
              disabled={integrations.sms.connected}
              onChange={(e) =>
                setSmsForm((f) => ({ ...f, fromNumber: e.target.value }))
              }
              placeholder="+15551234567"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {integrations.sms.connected ? (
            <button
              type="button"
              onClick={() => {
                disconnectSms();
                setSmsForm({ accountSid: "", authToken: "", fromNumber: "" });
                showToast(
                  language === "es" ? "SMS desconectado" : "SMS disconnected"
                );
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            >
              {t(language, "disconnect")}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={testing === "sms"}
                onClick={testSms}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                {t(language, "testConnection")}
              </button>
              <button
                type="button"
                onClick={onConnectSms}
                className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white"
              >
                {t(language, "connect")}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">
              {t(language, "emailSettings")}
            </h2>
            {integrations.email.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {t(language, "connectedBadge")}
              </span>
            )}
          </div>
          <Link
            href="/dashboard/email-marketing"
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            {t(language, "emailMarketing")} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "emailProvider")}
            </label>
            <select
              value={emailForm.provider}
              disabled={integrations.email.connected}
              onChange={(e) =>
                setEmailForm((f) => ({
                  ...f,
                  provider: e.target.value as EmailProvider,
                }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none disabled:bg-slate-50"
            >
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "apiKey")}
            </label>
            <input
              type="password"
              value={emailForm.apiKey}
              disabled={integrations.email.connected}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, apiKey: e.target.value }))
              }
              autoComplete="off"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "fromEmail")}
            </label>
            <input
              value={emailForm.fromEmail}
              disabled={integrations.email.connected}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, fromEmail: e.target.value }))
              }
              placeholder="hello@enone.app"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(language, "fromName")}
            </label>
            <input
              value={emailForm.fromName}
              disabled={integrations.email.connected}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, fromName: e.target.value }))
              }
              placeholder="enone"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {integrations.email.connected ? (
            <button
              type="button"
              onClick={() => {
                disconnectEmail();
                setEmailForm({
                  provider: "resend",
                  apiKey: "",
                  fromEmail: "",
                  fromName: "",
                });
                showToast(
                  language === "es"
                    ? "Email desconectado"
                    : "Email disconnected"
                );
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            >
              {t(language, "disconnect")}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={testing === "email"}
                onClick={testEmail}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                {t(language, "testConnection")}
              </button>
              <button
                type="button"
                onClick={onConnectEmail}
                className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white"
              >
                {t(language, "connect")}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
