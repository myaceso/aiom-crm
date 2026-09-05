"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";

export default function Home() {
  const router = useRouter();
  const session = useStore((s) => s.session);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(session ? "/dashboard/start-here" : "/login");
  }, [hydrated, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f7fa]">
      <div className="boot-spinner" />
    </div>
  );
}
