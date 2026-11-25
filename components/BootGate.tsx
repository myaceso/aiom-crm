"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import { LANDING_PATH } from "@/lib/landing/config";

export default function BootGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const authReady = useStore((s) => s.authReady);
  const refreshAuth = useStore((s) => s.refreshAuth);
  const [minDone, setMinDone] = useState(false);
  const isPublicLanding = pathname === LANDING_PATH;

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hydrated) {
      if (!authReady) void refreshAuth();
    }
  }, [hydrated, authReady, refreshAuth]);

  if (isPublicLanding) {
    return <>{children}</>;
  }

  if (!hydrated || !minDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f7fa]">
        <div className="boot-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
