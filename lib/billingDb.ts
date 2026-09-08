import { promises as fs } from "fs";
import path from "path";
import type { UserBilling } from "./types";
import { getUserStoreBackend } from "./userDb";

const key = (userId: string) => `enone:billing:${userId}`;
const fsPath = () => path.join(process.cwd(), ".data", "enone-billing.json");

async function readFs(): Promise<Record<string, UserBilling>> {
  try {
    return JSON.parse(await fs.readFile(fsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeFs(data: Record<string, UserBilling>) {
  await fs.mkdir(path.dirname(fsPath()), { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify(data, null, 2));
}

async function ensurePg() {
  const { sql } = await import("@vercel/postgres");
  await sql`
    CREATE TABLE IF NOT EXISTS enone_billing (
      user_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function defaultBilling(): UserBilling {
  return { status: "unpaid", currency: "usd" };
}

export async function getBilling(userId: string): Promise<UserBilling> {
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    const stored = await kv.get<UserBilling>(key(userId));
    return stored || defaultBilling();
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const { rows } =
      await sql`SELECT data FROM enone_billing WHERE user_id = ${userId}`;
    return (rows[0]?.data as UserBilling) || defaultBilling();
  }
  const data = await readFs();
  return data[userId] || defaultBilling();
}

export async function saveBilling(
  userId: string,
  billing: UserBilling
): Promise<void> {
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(key(userId), billing);
    return;
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const payload = JSON.stringify(billing);
    await sql`
      INSERT INTO enone_billing (user_id, data, updated_at)
      VALUES (${userId}, ${payload}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return;
  }
  const data = await readFs();
  data[userId] = billing;
  await writeFs(data);
}

export async function markUserPaid(
  userId: string,
  input: {
    amountCents: number;
    provider: "stripe" | "paypal";
    externalId: string;
  }
): Promise<UserBilling> {
  const billing: UserBilling = {
    status: "paid",
    amountCents: input.amountCents,
    currency: "usd",
    provider: input.provider,
    paidAt: new Date().toISOString(),
    externalId: input.externalId,
  };
  await saveBilling(userId, billing);
  return billing;
}
