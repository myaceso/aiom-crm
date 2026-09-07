"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPath } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

/** Blocks dashboard routes the current user cannot access. */
export default function PermissionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const language = useStore((s) => s.settings.language);
  const users = useStore((s) => s.users);
  const session = useStore((s) => s.session);
  const user = users.find((u) => u.id === session?.userId) ?? null;
  const allowed = canAccessPath(user, pathname);

  useEffect(() => {
    if (!session || !user) return;
    if (!allowed) {
      router.replace("/dashboard/start-here");
    }
  }, [allowed, session, user, router, pathname]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-700">
          {t(language, "accessDenied")}
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/start-here")}
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          {t(language, "back")}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
