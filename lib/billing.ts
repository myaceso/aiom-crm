const MIN_CENTS = 100; // $1
const PRESET_CENTS = 1000; // $10

export { MIN_CENTS, PRESET_CENTS };

export function parseAmountCents(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n >= MIN_CENTS && n <= 1_000_000_00) return n;
    return null;
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= MIN_CENTS && n <= 1_000_000_00) return n;
    return null;
  }
  return null;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
