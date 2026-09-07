import { promises as fs } from "fs";
import path from "path";
import type { AppUser, PermissionKey, UserRole } from "./types";
import { ALL_PERMISSIONS } from "./auth";

const USERS_INDEX_KEY = "enone:users";
const userKey = (id: string) => `enone:user:${id}`;

export type StoredUser = AppUser;

function hasKvEnv(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function hasPostgresEnv(): boolean {
  return !!(
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

function isProd(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function allowFsFallback(): boolean {
  return !isProd() || process.env.ALLOW_FS_USER_STORE === "1";
}

const fsPath = () => path.join(process.cwd(), ".data", "enone-users.json");

async function readFs(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(fsPath(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.users) ? (data.users as StoredUser[]) : [];
  } catch {
    return [];
  }
}

async function writeFs(users: StoredUser[]): Promise<void> {
  const dir = path.dirname(fsPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify({ users }, null, 2), "utf8");
}

async function ensurePgTable(): Promise<void> {
  const { sql } = await import("@vercel/postgres");
  await sql`
    CREATE TABLE IF NOT EXISTS enone_users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;
}

type Backend = "kv" | "postgres" | "fs";

function pickBackend(): Backend {
  if (hasKvEnv()) return "kv";
  if (hasPostgresEnv()) return "postgres";
  if (allowFsFallback()) return "fs";
  throw new Error(
    "No user store configured. Set KV_REST_API_URL + KV_REST_API_TOKEN (preferred) or POSTGRES_URL for production."
  );
}

export function getUserStoreBackend(): Backend {
  return pickBackend();
}

export async function listUsers(): Promise<StoredUser[]> {
  const backend = pickBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    const ids = ((await kv.get<string[]>(USERS_INDEX_KEY)) || []) as string[];
    if (!ids.length) return [];
    const users = await Promise.all(
      ids.map((id) => kv.get<StoredUser>(userKey(id)))
    );
    return users.filter((u): u is StoredUser => !!u);
  }
  if (backend === "postgres") {
    await ensurePgTable();
    const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`SELECT data FROM enone_users`;
    return rows.map((r) => r.data as StoredUser);
  }
  return readFs();
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  const backend = pickBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    return ((await kv.get<StoredUser>(userKey(id))) as StoredUser | null) || null;
  }
  if (backend === "postgres") {
    await ensurePgTable();
    const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`SELECT data FROM enone_users WHERE id = ${id}`;
    return rows[0] ? (rows[0].data as StoredUser) : null;
  }
  const users = await readFs();
  return users.find((u) => u.id === id) || null;
}

export async function getUserByEmail(
  email: string
): Promise<StoredUser | null> {
  const clean = email.trim().toLowerCase();
  const users = await listUsers();
  return users.find((u) => u.email === clean) || null;
}

export async function countUsers(): Promise<number> {
  const backend = pickBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    const ids = ((await kv.get<string[]>(USERS_INDEX_KEY)) || []) as string[];
    return ids.length;
  }
  if (backend === "postgres") {
    await ensurePgTable();
    const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`SELECT COUNT(*)::int AS c FROM enone_users`;
    return Number(rows[0]?.c || 0);
  }
  return (await readFs()).length;
}

export async function saveUser(user: StoredUser): Promise<void> {
  const backend = pickBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(userKey(user.id), user);
    const ids = ((await kv.get<string[]>(USERS_INDEX_KEY)) || []) as string[];
    if (!ids.includes(user.id)) {
      await kv.set(USERS_INDEX_KEY, [...ids, user.id]);
    }
    return;
  }
  if (backend === "postgres") {
    await ensurePgTable();
    const { sql } = await import("@vercel/postgres");
    const payload = JSON.stringify(user);
    await sql`
      INSERT INTO enone_users (id, data)
      VALUES (${user.id}, ${payload}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return;
  }
  const users = await readFs();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  await writeFs(users);
}

export function toPublicUser(user: StoredUser) {
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

export function newUserId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildAdminUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): StoredUser {
  return {
    id: newUserId(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role: "admin",
    permissions: [...ALL_PERMISSIONS],
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function buildStaffUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: PermissionKey[];
}): StoredUser {
  const role: UserRole = input.role === "admin" ? "admin" : "staff";
  return {
    id: newUserId(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role,
    permissions:
      role === "admin"
        ? [...ALL_PERMISSIONS]
        : input.permissions.filter((p) => p !== "users"),
    active: true,
    createdAt: new Date().toISOString(),
  };
}
