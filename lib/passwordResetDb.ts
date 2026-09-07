import { promises as fs } from "fs";
import path from "path";
import { getUserStoreBackend } from "./userDb";

const PREFIX = "enone:reset:";
const TTL_SECONDS = 24 * 60 * 60;
type ResetRecord = { userId: string; expiresAt: string };

async function digest(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function tokenValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const fsPath = () => path.join(process.cwd(), ".data", "enone-password-resets.json");
async function readFs(): Promise<Record<string, ResetRecord>> {
  try {
    return JSON.parse(await fs.readFile(fsPath(), "utf8"));
  } catch {
    return {};
  }
}
async function writeFs(data: Record<string, ResetRecord>) {
  await fs.mkdir(path.dirname(fsPath()), { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify(data, null, 2));
}
async function ensurePg() {
  const { sql } = await import("@vercel/postgres");
  await sql`CREATE TABLE IF NOT EXISTS enone_password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`;
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = tokenValue();
  const hash = await digest(token);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(`${PREFIX}${hash}`, { userId, expiresAt }, { ex: TTL_SECONDS });
  } else if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    await sql`DELETE FROM enone_password_resets WHERE user_id = ${userId}`;
    await sql`INSERT INTO enone_password_resets (token_hash,user_id,expires_at) VALUES (${hash},${userId},${expiresAt})`;
  } else {
    const data = await readFs();
    for (const [key, value] of Object.entries(data)) if (value.userId === userId) delete data[key];
    data[hash] = { userId, expiresAt };
    await writeFs(data);
  }
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const hash = await digest(token);
  const backend = getUserStoreBackend();
  let record: ResetRecord | null = null;
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    record = await kv.get<ResetRecord>(`${PREFIX}${hash}`);
    await kv.del(`${PREFIX}${hash}`);
  } else if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`DELETE FROM enone_password_resets WHERE token_hash = ${hash} RETURNING user_id, expires_at`;
    if (rows[0]) record = { userId: String(rows[0].user_id), expiresAt: new Date(rows[0].expires_at).toISOString() };
  } else {
    const data = await readFs();
    record = data[hash] || null;
    delete data[hash];
    await writeFs(data);
  }
  return record && Date.parse(record.expiresAt) > Date.now() ? record.userId : null;
}
