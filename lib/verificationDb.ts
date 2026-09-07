import { promises as fs } from "fs";
import path from "path";
import { getUserStoreBackend } from "./userDb";

const PREFIX = "enone:verify:";
const TTL_SECONDS = 24 * 60 * 60;
type VerificationRecord = { userId: string; expiresAt: string };

async function digest(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function tokenValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const fsPath = () => path.join(process.cwd(), ".data", "enone-verifications.json");
async function readFs(): Promise<Record<string, VerificationRecord>> { try { return JSON.parse(await fs.readFile(fsPath(), "utf8")); } catch { return {}; } }
async function writeFs(data: Record<string, VerificationRecord>) { await fs.mkdir(path.dirname(fsPath()), { recursive: true }); await fs.writeFile(fsPath(), JSON.stringify(data, null, 2)); }
async function ensurePg() { const { sql } = await import("@vercel/postgres"); await sql`CREATE TABLE IF NOT EXISTS enone_verifications (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`; }

export async function createVerificationToken(userId: string): Promise<string> {
  const token = tokenValue();
  const hash = await digest(token);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(`${PREFIX}${hash}`, { userId, expiresAt }, { ex: TTL_SECONDS });
  } else if (backend === "postgres") {
    await ensurePg(); const { sql } = await import("@vercel/postgres");
    await sql`DELETE FROM enone_verifications WHERE user_id = ${userId}`;
    await sql`INSERT INTO enone_verifications (token_hash,user_id,expires_at) VALUES (${hash},${userId},${expiresAt})`;
  } else {
    const data = await readFs();
    for (const [key, value] of Object.entries(data)) if (value.userId === userId) delete data[key];
    data[hash] = { userId, expiresAt }; await writeFs(data);
  }
  return token;
}

export async function consumeVerificationToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const hash = await digest(token);
  const backend = getUserStoreBackend();
  let record: VerificationRecord | null = null;
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv"); record = await kv.get<VerificationRecord>(`${PREFIX}${hash}`); await kv.del(`${PREFIX}${hash}`);
  } else if (backend === "postgres") {
    await ensurePg(); const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`DELETE FROM enone_verifications WHERE token_hash = ${hash} RETURNING user_id, expires_at`;
    if (rows[0]) record = { userId: String(rows[0].user_id), expiresAt: new Date(rows[0].expires_at).toISOString() };
  } else {
    const data = await readFs(); record = data[hash] || null; delete data[hash]; await writeFs(data);
  }
  return record && Date.parse(record.expiresAt) > Date.now() ? record.userId : null;
}
