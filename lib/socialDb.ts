/** Server-side storage for scheduled / published Facebook + Instagram posts. */
import type { ScheduledPost } from "./types";
import { delKey, getJson, getManyJson, setAdd, setJson, setMembers, setRemove } from "./kvStore";

const postKey = (userId: string, id: string) => `enone:social:post:${userId}:${id}`;
const userIndexKey = (userId: string) => `enone:social:user:${userId}`;
/** Global set of `${userId}:${postId}` that still need work (scheduled / publishing). */
export const DUE_SET = "enone:social:due";

export function newPostId(): string {
  return `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function getPost(userId: string, id: string): Promise<ScheduledPost | null> {
  return getJson<ScheduledPost>(postKey(userId, id));
}

export async function listPosts(userId: string): Promise<ScheduledPost[]> {
  const ids = await setMembers(userIndexKey(userId));
  const posts = await getManyJson<ScheduledPost>(ids.map((id) => postKey(userId, id)));
  return posts
    .filter((p): p is ScheduledPost => !!p)
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
}

export async function savePost(post: ScheduledPost): Promise<void> {
  post.updatedAt = new Date().toISOString();
  await setJson(postKey(post.userId, post.id), post);
  await setAdd(userIndexKey(post.userId), post.id);
  const member = `${post.userId}:${post.id}`;
  if (post.status === "scheduled" || post.status === "publishing") {
    await setAdd(DUE_SET, member);
  } else {
    await setRemove(DUE_SET, member);
  }
}

export async function deletePost(userId: string, id: string): Promise<void> {
  await delKey(postKey(userId, id));
  await setRemove(userIndexKey(userId), id);
  await setRemove(DUE_SET, `${userId}:${id}`);
}

export async function listDueMembers(): Promise<{ userId: string; postId: string }[]> {
  const members = await setMembers(DUE_SET);
  return members
    .map((m) => {
      const i = m.lastIndexOf(":");
      return { userId: m.slice(0, i), postId: m.slice(i + 1) };
    })
    .filter((x) => x.userId && x.postId);
}

export async function removeDueMember(userId: string, postId: string): Promise<void> {
  await setRemove(DUE_SET, `${userId}:${postId}`);
}
