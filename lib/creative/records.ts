import { delKey, getJson, getManyJson, setAdd, setJson, setMembers, setRemove } from "@/lib/kvStore";
import type { CreativeJob, StoredCreativeAsset } from "./types";

const assetKey = (userId: string, id: string) => `enone:creative:asset:${userId}:${id}`;
const assetSet = (userId: string) => `enone:creative:assets:${userId}`;
const jobKey = (userId: string, id: string) => `enone:creative:job:${userId}:${id}`;
const pendingSet = (userId: string) => `enone:creative:pending:${userId}`;

const PENDING_TTL_MS = 30 * 60 * 1000;

export async function saveAsset(asset: StoredCreativeAsset): Promise<void> {
  await setJson(assetKey(asset.userId, asset.id), asset);
  await setAdd(assetSet(asset.userId), asset.id);
}

export async function getAsset(userId: string, id: string): Promise<StoredCreativeAsset | null> {
  const asset = await getJson<StoredCreativeAsset>(assetKey(userId, id));
  if (!asset || asset.userId !== userId) return null;
  return asset;
}

export async function listAssets(userId: string): Promise<StoredCreativeAsset[]> {
  const ids = await setMembers(assetSet(userId));
  if (!ids.length) return [];
  const rows = await getManyJson<StoredCreativeAsset>(ids.map((id) => assetKey(userId, id)));
  return rows
    .filter((row): row is StoredCreativeAsset => !!row && row.userId === userId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function removeAssetRecord(userId: string, id: string): Promise<StoredCreativeAsset | null> {
  const asset = await getAsset(userId, id);
  await delKey(assetKey(userId, id));
  await setRemove(assetSet(userId), id);
  return asset;
}

export async function trimAssets(userId: string, keep = 40): Promise<StoredCreativeAsset[]> {
  const all = await listAssets(userId);
  return all.slice(keep);
}

export async function saveJob(job: CreativeJob): Promise<void> {
  await setJson(jobKey(job.userId, job.id), job);
}

export async function getJob(userId: string, id: string): Promise<CreativeJob | null> {
  const job = await getJson<CreativeJob>(jobKey(userId, id));
  if (!job || job.userId !== userId) return null;
  return job;
}

export async function trackPending(userId: string, jobId: string): Promise<void> {
  await setAdd(pendingSet(userId), jobId);
}

export async function clearPending(userId: string, jobId: string): Promise<void> {
  await setRemove(pendingSet(userId), jobId);
}

/** Drop video jobs nobody has finished so a stuck task cannot block the account. */
export async function sweepPending(userId: string): Promise<void> {
  const ids = await setMembers(pendingSet(userId));
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const id of ids) {
    const job = await getJob(userId, id);
    const stale = !job || job.status !== "pending" || Date.parse(job.createdAt) < cutoff;
    if (!stale) continue;
    await setRemove(pendingSet(userId), id);
    if (job?.status === "pending") {
      await saveJob({
        ...job,
        status: "failed",
        error: "expired",
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function countPending(userId: string): Promise<number> {
  await sweepPending(userId);
  return (await setMembers(pendingSet(userId))).length;
}
