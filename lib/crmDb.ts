import { promises as fs } from "fs";
import path from "path";
import type { CrmState } from "./types";
import { getUserStoreBackend } from "./userDb";

const key = (userId: string) => `enone:crm:${userId}`;
const fsPath = () => path.join(process.cwd(), ".data", "enone-crm-states.json");
async function readFs(): Promise<Record<string, CrmState>> { try { return JSON.parse(await fs.readFile(fsPath(), "utf8")); } catch { return {}; } }
async function writeFs(data: Record<string, CrmState>) { await fs.mkdir(path.dirname(fsPath()), { recursive: true }); await fs.writeFile(fsPath(), JSON.stringify(data, null, 2)); }
async function ensurePg() { const { sql } = await import("@vercel/postgres"); await sql`CREATE TABLE IF NOT EXISTS enone_crm_states (user_id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; }

export async function getCrmState(userId: string): Promise<CrmState | null> {
  const backend = getUserStoreBackend();
  if (backend === "kv") { const { kv } = await import("@vercel/kv"); return await kv.get<CrmState>(key(userId)); }
  if (backend === "postgres") { await ensurePg(); const { sql } = await import("@vercel/postgres"); const { rows } = await sql`SELECT data FROM enone_crm_states WHERE user_id=${userId}`; return rows[0]?.data as CrmState || null; }
  return (await readFs())[userId] || null;
}
export async function saveCrmState(userId: string, state: CrmState): Promise<void> {
  const backend = getUserStoreBackend();
  if (backend === "kv") { const { kv } = await import("@vercel/kv"); await kv.set(key(userId), state); return; }
  if (backend === "postgres") { await ensurePg(); const { sql } = await import("@vercel/postgres"); const payload=JSON.stringify(state); await sql`INSERT INTO enone_crm_states (user_id,data,updated_at) VALUES (${userId},${payload}::jsonb,NOW()) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`; return; }
  const data=await readFs(); data[userId]=state; await writeFs(data);
}
