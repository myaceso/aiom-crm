import { getCrmState, saveCrmState } from "../crmDb";
import {
  createSeedSocialConnections,
  defaultIntegrations,
  defaultSettings,
} from "../seed";
import type { Contact, CrmState } from "../types";
import { getUserById, listUsers } from "../userDb";
import { landingActivity } from "./lead";

const locks = new Map<string, Promise<unknown>>();

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(userId, gate);
  return prev.then(fn, fn).finally(release);
}

export function emptyCrmState(): CrmState {
  return {
    settings: { ...defaultSettings },
    contacts: [],
    opportunities: [],
    conversations: [],
    appointments: [],
    activity: [],
    socialConnections: createSeedSocialConnections(),
    socialPosts: [],
    mediaAssets: [],
    smsCampaigns: [],
    emailCampaigns: [],
    emailTemplates: [],
    integrations: {
      sms: { ...defaultIntegrations.sms },
      email: { ...defaultIntegrations.email },
      whatsapp: { ...defaultIntegrations.whatsapp },
      telegram: { ...defaultIntegrations.telegram },
      creative: { ...defaultIntegrations.creative },
    },
    messagingSends: [],
  };
}

/** Oldest active admin, unless LANDING_CRM_USER_ID points at an active user. */
export async function resolveLandingOwnerId(): Promise<string | null> {
  const configured = process.env.LANDING_CRM_USER_ID?.trim();
  if (configured) {
    const user = await getUserById(configured);
    if (user?.active) return user.id;
    return null;
  }
  const admins = (await listUsers())
    .filter((user) => user.role === "admin" && user.active)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return admins[0]?.id ?? null;
}

export async function appendLandingLead(
  contact: Contact
): Promise<{ ok: true; userId: string } | { ok: false; error: "no_owner" }> {
  const userId = await resolveLandingOwnerId();
  if (!userId) return { ok: false, error: "no_owner" };

  await withUserLock(userId, async () => {
    const existing = await getCrmState(userId);
    const base = existing ?? emptyCrmState();
    const contacts = Array.isArray(base.contacts) ? base.contacts : [];
    const activity = Array.isArray(base.activity) ? base.activity : [];
    const next: CrmState = {
      ...base,
      contacts: [contact, ...contacts.filter((c) => c.id !== contact.id)],
      activity: [landingActivity(contact), ...activity.filter((a) => a.id !== `act-${contact.id}`)].slice(0, 100),
    };
    await saveCrmState(userId, next);
  });

  return { ok: true, userId };
}
