"use client";

import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { useStore } from "@/store/useStore";
import { t, type DictKey } from "@/lib/i18n";

const FEATURES: DictKey[] = ["homeFeature1", "homeFeature2", "homeFeature3"];

export default function Home() {
  const language = useStore((s) => s.settings.language);
  const session = useStore((s) => s.session);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50">
      <AuthHeader />
      <main className="mx-auto flex max-w-5xl flex-col items-center px-5 py-20 text-center sm:py-28">
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          enone.app CRM
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          {t(language, "homeHeadline")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          {t(language, "homeSubtitle")}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {session ? (
            <Link
              href="/dashboard/start-here"
              className="rounded-md bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
            >
              {t(language, "goToDashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
              >
                {t(language, "createAccount")}
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t(language, "signIn")}
              </Link>
            </>
          )}
        </div>
        <div className="mt-20 grid w-full gap-5 text-left sm:grid-cols-3">
          {FEATURES.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-indigo-100 bg-white p-6 shadow-sm"
            >
              <p className="font-semibold text-slate-800">{t(language, key)}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
