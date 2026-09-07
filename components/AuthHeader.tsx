"use client";

import Link from "next/link";
import Logo from "./Logo";
import LanguageSelector from "./LanguageSelector";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function AuthHeader() {
  const language = useStore((s) => s.settings.language);
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);
  const authReady = useStore((s) => s.authReady);

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-5">
      <Logo />
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/login"
          className="text-sm font-medium text-slate-600 hover:text-[#6366f1] hover:underline"
        >
          {t(language, "signIn")}
        </Link>
        <Link href="/signup" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          {t(language, "signUp")}
        </Link>
        {hydrated && authReady && session && (
          <Link
            href="/dashboard/start-here"
            className="text-sm font-medium text-[#6366f1] hover:underline"
          >
            {t(language, "goToDashboard")}
          </Link>
        )}
        <LanguageSelector />
      </div>
    </header>
  );
}
