"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/shell/Sidebar";
import TopBar from "@/components/shell/TopBar";
import PermissionGate from "@/components/PermissionGate";
import { useStore } from "@/store/useStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);
  const authReady = useStore((s) => s.authReady);
  const refreshAuth = useStore((s) => s.refreshAuth);
  const crmReady = useStore((s) => s.crmReady);
  const mobileNavOpen = useStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen);
  const users = useStore((s) => s.users);
  const logout = useStore((s) => s.logout);
  const currentUser = users.find((u) => u.id === session?.userId) ?? null;

  useEffect(() => {
    if (hydrated && !authReady) void refreshAuth();
  }, [hydrated, authReady, refreshAuth]);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (!session || !currentUser || !currentUser.active) {
      if (session && (!currentUser || !currentUser.active)) void logout();
      router.replace("/login");
    }
  }, [
    hydrated,
    authReady,
    session,
    currentUser,
    router,
    crmReady,
    logout,
  ]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setMobileNavOpen]);

  if (
    !hydrated ||
    !authReady ||
    !crmReady ||
    !session ||
    !currentUser ||
    !currentUser.active
  ) {
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
          <PermissionGate>{children}</PermissionGate>
        </main>
      </div>
    </div>
  );
}
