/**
 * Tiny server-side JSON key/value + set store on top of the same backend
 * selection as users/CRM (Vercel KV → Postgres → local .data file).
 */
import { promises as fs } from "fs";
import path from "path";
import { getUserStoreBackend } from "./userDb";

type FsDoc = { values: Record<string, unknown>; sets: Record<string, string[]>; locks: Record<string, number> };

const fsPath = () => path.join(process.cwd(), ".data", "enone-kv.json");

async function readFs(): Promise<FsDoc> {
  try {
    const d = JSON.parse(await fs.readFile(fsPath(), "utf8"));
    return { values: d.values || {}, sets: d.sets || {}, locks: d.locks || {} };
  } catch {
    return { values: {}, sets: {}, locks: {} };
  }
}
async function writeFs(doc: FsDoc) {
  await fs.mkdir(path.dirname(fsPath()), { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify(doc, null, 2));
}

let pgReady = false;
async function pg() {
  const { sql } = await import("@vercel/postgres");
  if (!pgReady) {
    await sql`CREATE TABLE IF NOT EXISTS enone_kv (key TEXT PRIMARY KEY, data JSONB NOT NULL, expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS enone_kv_sets (set_key TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (set_key, member))`;
    pgReady = true;
  }
  return sql;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    return ((await kv.get<T>(key)) as T | null) ?? null;
  }
  if (b === "postgres") {
    const sql = await pg();
    const { rows } = await sql`SELECT data FROM enone_kv WHERE key=${key} AND (expires_at IS NULL OR expires_at > NOW())`;
    return (rows[0]?.data as T) ?? null;
  }
  const d = await readFs();
  return (d.values[key] as T) ?? null;
}

export async function getManyJson<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    const out: (T | null)[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const vals = (await kv.mget<T[]>(...chunk)) as (T | null)[];
      out.push(...vals.map((v) => v ?? null));
    }
    return out;
  }
  return Promise.all(keys.map((k) => getJson<T>(k)));
}

export async function setJson(key: string, value: unknown): Promise<void> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
    return;
  }
  if (b === "postgres") {
    const sql = await pg();
    const payload = JSON.stringify(value);
    await sql`INSERT INTO enone_kv (key,data,updated_at) VALUES (${key},${payload}::jsonb,NOW()) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, expires_at=NULL, updated_at=NOW()`;
    return;
  }
  const d = await readFs();
  d.values[key] = value;
  await writeFs(d);
}

export async function delKey(key: string): Promise<void> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.del(key);
    return;
  }
  if (b === "postgres") {
    const sql = await pg();
    await sql`DELETE FROM enone_kv WHERE key=${key}`;
    return;
  }
  const d = await readFs();
  delete d.values[key];
  await writeFs(d);
}

export async function setAdd(setKey: string, member: string): Promise<void> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.sadd(setKey, member);
    return;
  }
  if (b === "postgres") {
    const sql = await pg();
    await sql`INSERT INTO enone_kv_sets (set_key,member) VALUES (${setKey},${member}) ON CONFLICT DO NOTHING`;
    return;
  }
  const d = await readFs();
  const s = new Set(d.sets[setKey] || []);
  s.add(member);
  d.sets[setKey] = Array.from(s);
  await writeFs(d);
}

export async function setRemove(setKey: string, member: string): Promise<void> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.srem(setKey, member);
    return;
  }
  if (b === "postgres") {
    const sql = await pg();
    await sql`DELETE FROM enone_kv_sets WHERE set_key=${setKey} AND member=${member}`;
    return;
  }
  const d = await readFs();
  d.sets[setKey] = (d.sets[setKey] || []).filter((m) => m !== member);
  await writeFs(d);
}

export async function setMembers(setKey: string): Promise<string[]> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    return ((await kv.smembers(setKey)) || []).map(String);
  }
  if (b === "postgres") {
    const sql = await pg();
    const { rows } = await sql`SELECT member FROM enone_kv_sets WHERE set_key=${setKey}`;
    return rows.map((r) => String(r.member));
  }
  const d = await readFs();
  return d.sets[setKey] || [];
}

/** Best-effort exclusive lock (returns true if acquired). */
export async function acquireLock(key: string, ttlSec: number): Promise<boolean> {
  const b = getUserStoreBackend();
  if (b === "kv") {
    const { kv } = await import("@vercel/kv");
    const r = await kv.set(key, Date.now(), { nx: true, ex: ttlSec });
    return r === "OK";
  }
  if (b === "postgres") {
    const sql = await pg();
    await sql`DELETE FROM enone_kv WHERE key=${key} AND expires_at IS NOT NULL AND expires_at <= NOW()`;
    const exp = new Date(Date.now() + ttlSec * 1000).toISOString();
    const { rowCount } = await sql`INSERT INTO enone_kv (key,data,expires_at) VALUES (${key},'1'::jsonb,${exp}) ON CONFLICT (key) DO NOTHING`;
    return (rowCount || 0) > 0;
  }
  const d = await readFs();
  const now = Date.now();
  if (d.locks[key] && d.locks[key] > now) return false;
  d.locks[key] = now + ttlSec * 1000;
  await writeFs(d);
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  const b = getUserStoreBackend();
  if (b === "kv" || b === "postgres") {
    await delKey(key);
    return;
  }
  const d = await readFs();
  delete d.locks[key];
  await writeFs(d);
}
