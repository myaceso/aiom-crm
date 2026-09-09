import { promises as fs } from "fs";
import path from "path";
import { getUserStoreBackend } from "./userDb";

export type AiStoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  title: string;
  messages: AiStoredMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AiChatStore = {
  conversations: AiConversation[];
};

const key = (userId: string) => `enone:ai-chats:${userId}`;
const fsPath = () => path.join(process.cwd(), ".data", "enone-ai-chats.json");

async function readFs(): Promise<Record<string, AiChatStore>> {
  try {
    return JSON.parse(await fs.readFile(fsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeFs(data: Record<string, AiChatStore>) {
  await fs.mkdir(path.dirname(fsPath()), { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify(data, null, 2));
}

async function ensurePg() {
  const { sql } = await import("@vercel/postgres");
  await sql`
    CREATE TABLE IF NOT EXISTS enone_ai_chats (
      user_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function emptyAiChatStore(): AiChatStore {
  return { conversations: [] };
}

export async function getAiChatStore(userId: string): Promise<AiChatStore> {
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    const stored = await kv.get<AiChatStore>(key(userId));
    return stored || emptyAiChatStore();
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const { rows } =
      await sql`SELECT data FROM enone_ai_chats WHERE user_id = ${userId}`;
    return (rows[0]?.data as AiChatStore) || emptyAiChatStore();
  }
  const data = await readFs();
  return data[userId] || emptyAiChatStore();
}

export async function saveAiChatStore(
  userId: string,
  store: AiChatStore
): Promise<void> {
  // Keep last 30 threads, 80 messages each
  const pruned: AiChatStore = {
    conversations: store.conversations
      .slice()
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .slice(0, 30)
      .map((c) => ({
        ...c,
        messages: c.messages.slice(-80),
      })),
  };

  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(key(userId), pruned);
    return;
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const payload = JSON.stringify(pruned);
    await sql`
      INSERT INTO enone_ai_chats (user_id, data, updated_at)
      VALUES (${userId}, ${payload}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return;
  }
  const data = await readFs();
  data[userId] = pruned;
  await writeFs(data);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function titleFromMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}
