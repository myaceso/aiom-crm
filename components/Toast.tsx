"use client";

import { useStore } from "@/store/useStore";
import { CheckCircle2, X } from "lucide-react";

export default function ToastHost() {
  const toast = useStore((s) => s.toast);
  const clearToast = useStore((s) => s.clearToast);
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span>{toast.message}</span>
      <button onClick={clearToast} className="ml-2 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
