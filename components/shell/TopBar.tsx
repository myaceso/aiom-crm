"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Megaphone, Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function TopBar() {
  const router = useRouter();
  const language = useStore((s) => s.settings.language);
  const session = useStore((s) => s.session);
  const logout = useStore((s) => s.logout);
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
      className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-4"
    >
      <button className="mr-auto hidden items-center gap-1.5 text-sm text-[var(--brand)] hover:underline sm:flex">
        <Megaphone className="h-4 w-4" />
        What&apos;s new
      </button>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
        title="Phone"
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f97316] text-white shadow-sm hover:bg-orange-600"
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
          className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-slate-50"
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
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {t(language, "settings")}
            </button>
            <button
              onClick={handleLogout}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              {t(language, "logout")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
