"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { UserBilling } from "@/lib/types";
import { useStore } from "@/store/useStore";
import { PRESET_CENTS, MIN_CENTS, formatUsd } from "@/lib/billing";
import clsx from "clsx";

function BillingPageInner() {
  const language = useStore((s) => s.settings.language);
  const showToast = useStore((s) => s.showToast);
  const searchParams = useSearchParams();

  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"stripe" | "paypal" | null>(null);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [customDollars, setCustomDollars] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const amountCents = useMemo(() => {
    if (mode === "preset") return PRESET_CENTS;
    const n = Math.round(parseFloat(customDollars || "0") * 100);
    return Number.isFinite(n) ? n : 0;
  }, [mode, customDollars]);

  const amountValid = amountCents >= MIN_CENTS;

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status_failed");
      setBilling(data.billing as UserBilling);
    } catch (err) {
      setError(err instanceof Error ? err.message : "status_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Handle PayPal return (?capture=1&token=ORDER_ID) and Stripe success banner
  useEffect(() => {
    const provider = searchParams.get("provider");
    const canceled = searchParams.get("canceled");
    const success = searchParams.get("success");
    const capture = searchParams.get("capture");
    const token = searchParams.get("token"); // PayPal order id

    if (canceled === "1") {
      showToast(t(language, "billingCanceled"));
      return;
    }

    if (provider === "paypal" && capture === "1" && token) {
      let cancelled = false;
      (async () => {
        setBusy("paypal");
        try {
          const res = await fetch("/api/billing/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: token }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "capture_failed");
          if (!cancelled) {
            setBilling(data.billing as UserBilling);
            showToast(t(language, "billingPaidSuccess"));
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "capture_failed");
            showToast(t(language, "billingPayFailed"));
          }
        } finally {
          if (!cancelled) setBusy(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (provider === "stripe" && success === "1") {
      const sessionId = searchParams.get("session_id");
      showToast(t(language, "billingPaidPending"));
      let cancelled = false;
      (async () => {
        if (sessionId) {
          try {
            const res = await fetch("/api/billing/stripe/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            const data = await res.json();
            if (res.ok && data.billing && !cancelled) {
              setBilling(data.billing as UserBilling);
              if (data.paid) showToast(t(language, "billingPaidSuccess"));
            }
          } catch {
            /* fall through to polling */
          }
        }
        if (cancelled) return;
        let tries = 0;
        const id = window.setInterval(() => {
          tries += 1;
          void loadStatus();
          if (tries >= 6) window.clearInterval(id);
        }, 1500);
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [searchParams, language, showToast, loadStatus]);

  async function payStripe(e?: FormEvent) {
    e?.preventDefault();
    if (!amountValid || busy) return;
    setBusy("stripe");
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.message || data.error || "checkout_failed");
      }
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "checkout_failed");
      showToast(t(language, "billingPayFailed"));
      setBusy(null);
    }
  }

  async function payPayPal(e?: FormEvent) {
    e?.preventDefault();
    if (!amountValid || busy) return;
    setBusy("paypal");
    setError(null);
    try {
      const res = await fetch("/api/billing/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.approveUrl) {
        throw new Error(data.message || data.error || "paypal_create_failed");
      }
      window.location.href = data.approveUrl as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "paypal_create_failed");
      showToast(t(language, "billingPayFailed"));
      setBusy(null);
    }
  }

  const paid = billing?.status === "paid";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {t(language, "billing")}
        </h1>
        <p className="text-sm text-slate-500">{t(language, "billingSubtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <>
          <div
            className={clsx(
              "rounded-xl border p-5 shadow-sm",
              paid
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            )}
          >
            <div className="flex items-start gap-3">
              {paid ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800">
                  {paid
                    ? t(language, "billingStatusPaid")
                    : t(language, "billingStatusUnpaid")}
                </div>
                {paid && billing?.amountCents != null && (
                  <p className="mt-1 text-xs text-slate-600">
                    {formatUsd(billing.amountCents)}
                    {billing.provider ? ` · ${billing.provider}` : ""}
                    {billing.paidAt
                      ? ` · ${new Date(billing.paidAt).toLocaleString()}`
                      : ""}
                  </p>
                )}
                {!paid && (
                  <p className="mt-1 text-xs text-slate-600">
                    {t(language, "billingUnpaidHint")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {!paid && (
            <form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  {t(language, "billingChooseAmount")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("preset")}
                    className={clsx(
                      "rounded-md px-4 py-2.5 text-sm font-semibold transition",
                      mode === "preset"
                        ? "brand-bg text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {t(language, "billingPreset10")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("custom")}
                    className={clsx(
                      "rounded-md px-4 py-2.5 text-sm font-semibold transition",
                      mode === "custom"
                        ? "brand-bg text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {t(language, "billingCustomAmount")}
                  </button>
                </div>
              </div>

              {mode === "custom" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">
                    {t(language, "billingAmountUsd")}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={customDollars}
                      onChange={(e) => setCustomDollars(e.target.value)}
                      className="w-full rounded-md border border-slate-200 py-2.5 pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {t(language, "billingMinAmount")}
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold">{t(language, "billingTotal")}: </span>
                <span className="font-mono">
                  {amountValid ? formatUsd(amountCents) : "—"}
                </span>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!amountValid || !!busy}
                  onClick={() => void payStripe()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "stripe" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {t(language, "billingPayStripe")}
                </button>
                <button
                  type="button"
                  disabled={!amountValid || !!busy}
                  onClick={() => void payPayPal()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#003087] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "paypal" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {t(language, "billingPayPayPal")}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}


export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" />
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}
