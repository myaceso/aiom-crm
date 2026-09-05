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

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/login");
    else ensureSeed();
  }, [hydrated, session, router, ensureSeed]);

  if (!hydrated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f7fa]">
        <div className="boot-spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f8]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
