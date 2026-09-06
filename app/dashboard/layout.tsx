"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/shell/Sidebar";
import TopBar from "@/components/shell/TopBar";
import { useStore } from "@/store/useStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);
  const ensureSeed = useStore((s) => s.ensureSeed);
  const mobileNavOpen = useStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/login");
    else ensureSeed();
  }, [hydrated, session, router, ensureSeed]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setMobileNavOpen]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f7fa]">
        <div className="boot-spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f4f6f8]">
      <Sidebar />
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          aria-label="Close menu overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
