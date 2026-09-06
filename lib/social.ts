import type { SocialConnection, SocialNetworkId } from "@/lib/types";
import { createSeedSocialConnections } from "@/lib/seed";

/** Ensure https:// when user pastes domain/path without scheme. */
export function normalizeProfileUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[\w./?#&=%-]+$/i.test(v)) return `https://${v}`;
  return v;
}

/** Soft URL check — accepts https URLs and common social paths. */
export function isValidProfileUrl(raw: string): boolean {
  const v = normalizeProfileUrl(raw);
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function mergeSocialConnections(
  existing: SocialConnection[]
): SocialConnection[] {
  const templates = createSeedSocialConnections();
  const byId = new Map(existing.map((c) => [c.id, c]));
  return templates.map((t) => {
    const c = byId.get(t.id);
    if (!c) return { ...t };
    return {
      ...t,
      ...c,
      handle: c.handle ?? "",
      profileUrl: c.profileUrl ?? "",
      accessToken: c.accessToken ?? "",
      pageId: c.pageId ?? "",
      connected: Boolean(c.connected),
    };
  });
}

export function buildConnectedSocial(
  id: SocialNetworkId,
  existing: SocialConnection | undefined,
  data: {
    handle?: string;
    profileUrl?: string;
    accessToken?: string;
    pageId?: string;
  }
): SocialConnection {
  const template =
    createSeedSocialConnections().find((c) => c.id === id) || {
      id,
      name: String(id),
      connected: false,
      handle: "",
      profileUrl: "",
      accessToken: "",
      pageId: "",
    };
  const handle = (data.handle ?? existing?.handle ?? "").trim();
  const profileUrl = normalizeProfileUrl(
    (data.profileUrl ?? existing?.profileUrl ?? "").trim()
  );
  const accessToken = (data.accessToken ?? existing?.accessToken ?? "").trim();
  const pageId = (data.pageId ?? existing?.pageId ?? "").trim();
  return {
    ...template,
    ...existing,
    id,
    connected: true,
    handle,
    profileUrl,
    accessToken,
    pageId,
  };
}
