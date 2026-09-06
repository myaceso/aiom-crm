"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function LoginPage() {
  const router = useRouter();
  const language = useStore((s) => s.settings.language);
  const login = useStore((s) => s.login);
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && session) router.replace("/dashboard/start-here");
  }, [hydrated, session, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(t(language, "emailRequired"));
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    login(email.trim());
    router.push("/dashboard/start-here");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-[440px] rounded-lg bg-white p-5 shadow-card sm:p-8 md:p-10">
          <h1 className="mb-8 text-center text-[22px] font-semibold text-[#4b5563]">
            {t(language, "signInTitle")}
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
                  autoComplete="current-password"
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
              <div className="mt-2 flex justify-end">
                <Link
                  href="/reset-password"
                  className="text-sm font-medium text-[#6366f1] hover:underline"
                >
                  {t(language, "forgotPassword")}
                </Link>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t(language, "signIn")}
            </button>
          </form>
          <p className="mt-6 text-center text-xs leading-relaxed text-[#607179]">
            {t(language, "terms")}{" "}
            <a href="#" className="font-medium text-[#6366f1] hover:underline">
              {t(language, "termsLink")}
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
