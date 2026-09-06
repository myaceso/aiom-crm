"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function ResetPasswordPage() {
  const language = useStore((s) => s.settings.language);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError(t(language, "emailRequired"));
      setSent(false);
      return;
    }
    setError("");
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f2f7fa]">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-[440px] rounded-lg bg-white p-5 shadow-card sm:p-8 md:p-10">
          <h1 className="mb-8 text-center text-[22px] font-semibold text-[#4b5563]">
            {t(language, "resetTitle")}
          </h1>
          <form onSubmit={onSubmit} className="space-y-5">
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
              />
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              {sent && !error && (
                <p className="mt-2 text-sm text-emerald-600">{t(language, "resetSent")}</p>
              )}
            </div>
            <button
              type="submit"
              className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t(language, "resetButton")}
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-[#6366f1] hover:underline">
              {t(language, "backToLogin")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
