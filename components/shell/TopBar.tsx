"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Megaphone, Menu, Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function TopBar() {
  const router = useRouter();
  const language = useStore((s) => s.settings.language);
  const session = useStore((s) => s.session);
  const logout = useStore((s) => s.logout);
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const initial = (session?.email?.[0] || "D").toUpperCase();

  return (
    <header
      ref={menuRef}
      className="flex min-h-12 shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-slate-200 bg-white px-3 py-1.5 sm:gap-2 sm:px-4"
    >
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="mr-auto flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
        aria-label={t(language, "openMenu")}
        aria-controls="app-sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button className="mr-auto hidden min-h-[40px] items-center gap-1.5 px-1 text-sm text-[var(--brand)] hover:underline md:flex">
        <Megaphone className="h-4 w-4" />
        What&apos;s new
      </button>

      <button
        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
        title="Phone"
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316] text-white shadow-sm hover:bg-orange-600"
        title={t(language, "notifications")}
      >
        <Bell className="h-4 w-4 fill-white" />
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          1
        </span>
      </button>
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f] text-sm font-semibold text-white">
            {initial}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
              {session?.email}
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/dashboard/settings");
              }}
              className="block min-h-[40px] w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {t(language, "settings")}
            </button>
            <button
              onClick={handleLogout}
              className="block min-h-[40px] w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              {t(language, "logout")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
