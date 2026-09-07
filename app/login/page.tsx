"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const language = useStore((s) => s.settings.language);
  const login = useStore((s) => s.login);
  const logout = useStore((s) => s.logout);
  const bootstrapAdmin = useStore((s) => s.bootstrapAdmin);
  const refreshAuth = useStore((s) => s.refreshAuth);
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);
  const authReady = useStore((s) => s.authReady);
  const needsBootstrap = useStore((s) => s.needsBootstrap);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    if (hydrated && !authReady) void refreshAuth();
  }, [hydrated, authReady, refreshAuth]);

  useEffect(() => {
    const verification = search.get("verification");
    if (verification === "success") setInfo(t(language, "verificationSuccess"));
    if (verification === "invalid") setError(t(language, "verificationInvalid"));
  }, [search, language]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setPendingEmail("");
    if (!email.trim()) {
      setError(t(language, "emailRequired"));
      return;
    }
    if (password.length < 4) {
      setError(t(language, "passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      if (needsBootstrap) {
        if (!name.trim()) {
          setError(t(language, "requiredFields"));
          return;
        }
        const res = await bootstrapAdmin({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (!res.ok) {
          setError(
            res.error === "users_exist"
              ? t(language, "haveAccount")
              : t(language, "requiredFields")
          );
          return;
        }
      } else {
        const res = await login(email.trim(), password);
        if (!res.ok) {
          if (res.error === "pending_verification") {
            setPendingEmail(email.trim());
            setError(t(language, "pendingVerification"));
          } else if (res.error === "account_inactive") {
            setError(t(language, "accountInactive"));
          } else {
            setError(t(language, "invalidCredentials"));
          }
          return;
        }
      }
      router.push("/dashboard/start-here");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "email_not_configured"
            ? t(language, "emailNotConfigured")
            : t(language, "serverError")
        );
        return;
      }
      setInfo(t(language, "verificationResent"));
      setError("");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOutOther() {
    await logout();
    setEmail("");
    setPassword("");
    setName("");
    setError("");
    setInfo("");
    await refreshAuth();
  }

  const ready = hydrated && authReady;
  const isBootstrap = ready && needsBootstrap;
  const showSignedInPanel = ready && !!session && !needsBootstrap;

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8fafc]">
        <AuthHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="boot-spinner" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-[440px] rounded-lg bg-white p-5 shadow-card sm:p-8 md:p-10">
          {showSignedInPanel ? (
            <>
              <h1 className="mb-2 text-center text-[22px] font-semibold text-[#4b5563]">
                {t(language, "signedInAs")}
              </h1>
              <p className="mb-8 break-all text-center text-sm font-medium text-[#6366f1]">
                {session.email}
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/start-here")}
                  className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {t(language, "goToDashboard")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOutOther()}
                  className="w-full rounded-md border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t(language, "signOutOtherAccount")}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-center text-[22px] font-semibold text-[#4b5563]">
                {isBootstrap
                  ? t(language, "bootstrapTitle")
                  : t(language, "signInTitle")}
              </h1>
              {isBootstrap ? (
                <p className="mb-6 text-center text-sm text-slate-500">
                  {t(language, "bootstrapSubtitle")}
                </p>
              ) : (
                <p className="mb-6 text-center text-sm text-slate-500">
                  {t(language, "noAccountPrompt")}{" "}
                  <Link href="/signup" className="font-semibold text-[#6366f1] hover:underline">
                    {t(language, "createAccount")}
                  </Link>
                </p>
              )}
              <form onSubmit={onSubmit} className="space-y-5">
                {isBootstrap && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                      {t(language, "userName")}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                    {t(language, "email")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(language, "emailPlaceholder")}
                    className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#607179]">
                    {t(language, "password")}
                  </label>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t(language, "passwordPlaceholder")}
                      className="w-full rounded-md border border-[#d1d5db] px-3 py-2.5 pr-10 text-sm text-[#374151] outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#6366f1]/35"
                      autoComplete={isBootstrap ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Toggle password"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isBootstrap && (
                    <div className="mt-2 flex justify-end">
                      <Link href="/reset-password" className="text-sm font-medium text-[#6366f1] hover:underline">
                        {t(language, "forgotPassword")}
                      </Link>
                    </div>
                  )}
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                {info && <p className="text-sm text-emerald-600">{info}</p>}
                {pendingEmail && (
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={busy}
                    className="text-sm font-semibold text-[#6366f1] hover:underline disabled:opacity-60"
                  >
                    {t(language, "resendVerification")}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {isBootstrap ? t(language, "createAdmin") : t(language, "signIn")}
                </button>
              </form>
              {!isBootstrap && (
                <p className="mt-6 text-center text-sm text-slate-500">
                  {t(language, "noAccountPrompt")}{" "}
                  <Link href="/signup" className="font-semibold text-[#6366f1] hover:underline">
                    {t(language, "signUp")}
                  </Link>
                </p>
              )}
              <p className="mt-6 text-center text-xs leading-relaxed text-[#607179]">
                {t(language, "terms")}{" "}
                <a href="#" className="font-medium text-[#6366f1] hover:underline">
                  {t(language, "termsLink")}
                </a>
                .
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
