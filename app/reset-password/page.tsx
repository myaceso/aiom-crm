"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function ResetPasswordPage() {
  const language = useStore((s) => s.settings.language);
  const search = useSearchParams();
  const token = (search.get("token") || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onRequestReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!email.trim()) {
      setError(t(language, "emailRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "email_not_configured") {
          setError(t(language, "emailNotConfigured"));
        } else {
          setError(t(language, "serverError"));
        }
        return;
      }
      setSent(true);
    } catch {
      setError(t(language, "serverError"));
    } finally {
      setBusy(false);
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (password.length < 8) {
      setError(t(language, "passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t(language, "passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "invalid_token") {
          setError(t(language, "resetInvalidToken"));
        } else if (data.error === "password_too_short") {
          setError(t(language, "passwordMinLength"));
        } else {
          setError(t(language, "serverError"));
        }
        return;
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError(t(language, "serverError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f2f7fa]">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-[440px] rounded-lg bg-white p-5 shadow-card sm:p-8 md:p-10">
          <h1 className="mb-8 text-center text-[22px] font-semibold text-[#4b5563]">
            {t(language, "resetTitle")}
          </h1>

          {token ? (
            done ? (
              <div className="space-y-5 text-center">
                <p className="text-sm text-emerald-600">{t(language, "resetSuccess")}</p>
                <Link href="/login" className="inline-block text-sm font-medium text-[#6366f1] hover:underline">
                  {t(language, "backToLogin")}
                </Link>
              </div>
            ) : (
              <form onSubmit={onSetPassword} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                    {t(language, "newPassword")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t(language, "passwordPlaceholder")}
                    className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                    {t(language, "confirmPassword")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={t(language, "passwordPlaceholder")}
                    className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? t(language, "sending") : t(language, "setNewPassword")}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={onRequestReset} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                  {t(language, "email")}
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(language, "emailPlaceholder")}
                  className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                />
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                {sent && !error && (
                  <p className="mt-2 text-sm text-emerald-600">{t(language, "resetSent")}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? t(language, "sending") : t(language, "resetButton")}
              </button>
            </form>
          )}

          {!done && (
            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm font-medium text-[#6366f1] hover:underline">
                {t(language, "backToLogin")}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
