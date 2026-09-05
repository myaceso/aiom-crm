"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

export default function BootGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const ensureSeed = useStore((s) => s.ensureSeed);
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hydrated) ensureSeed();
  }, [hydrated, ensureSeed]);

  if (!hydrated || !minDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f7fa]">
        <div className="boot-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
