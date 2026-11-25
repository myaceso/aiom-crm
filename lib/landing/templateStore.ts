import { promises as fs } from "fs";
import path from "path";
import { getUserStoreBackend } from "../userDb";
import { LANDING_PAGE_ID, type LandingTemplate } from "./template";

type LandingRecord = {
  draft: LandingTemplate | null;
  published: LandingTemplate | null;
};

const key = (id: string) => `enone:landing-page:${id}`;
const fsPath = () => path.join(process.cwd(), ".data", "enone-landing-pages.json");

async function readFs(): Promise<Record<string, LandingRecord>> {
  try {
    return JSON.parse(await fs.readFile(fsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeFs(data: Record<string, LandingRecord>) {
  await fs.mkdir(path.dirname(fsPath()), { recursive: true });
  await fs.writeFile(fsPath(), JSON.stringify(data, null, 2));
}

async function ensurePg() {
  const { sql } = await import("@vercel/postgres");
  await sql`CREATE TABLE IF NOT EXISTS enone_landing_pages (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}

export async function getLandingRecord(id = LANDING_PAGE_ID): Promise<LandingRecord> {
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<LandingRecord>(key(id))) ?? { draft: null, published: null };
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const { rows } = await sql`SELECT data FROM enone_landing_pages WHERE id=${id}`;
    return (rows[0]?.data as LandingRecord) ?? { draft: null, published: null };
  }
  return (await readFs())[id] ?? { draft: null, published: null };
}

export async function saveLandingRecord(record: LandingRecord, id = LANDING_PAGE_ID): Promise<void> {
  const backend = getUserStoreBackend();
  if (backend === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(key(id), record);
    return;
  }
  if (backend === "postgres") {
    await ensurePg();
    const { sql } = await import("@vercel/postgres");
    const payload = JSON.stringify(record);
    await sql`INSERT INTO enone_landing_pages (id,data,updated_at) VALUES (${id},${payload}::jsonb,NOW()) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
    return;
  }
  const data = await readFs();
  data[id] = record;
  await writeFs(data);
}

export async function getPublishedLanding(id = LANDING_PAGE_ID): Promise<LandingTemplate | null> {
  const record = await getLandingRecord(id);
  return record.published;
}
