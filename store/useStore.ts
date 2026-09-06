"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Contact,
  Opportunity,
  Conversation,
  Appointment,
  Activity,
  Settings,
  Stage,
  Lang,
  Note,
  SocialConnection,
  SocialPost,
  SocialNetworkId,
  MediaAsset,
  SmsCampaign,
  EmailCampaign,
  EmailTemplate,
  Integrations,
  SmsIntegration,
  EmailIntegration,
} from "@/lib/types";
import {
  createSeedContacts,
  createSeedOpportunities,
  createSeedConversations,
  createSeedAppointments,
  createSeedActivity,
  createSeedSocialConnections,
  createSeedSocialPosts,
  createSeedSmsCampaigns,
  createSeedEmailCampaigns,
  createSeedEmailTemplates,
  defaultSettings,
  defaultIntegrations,
} from "@/lib/seed";
import {
  buildConnectedSocial,
  mergeSocialConnections,
} from "@/lib/social";

type Toast = { id: string; message: string } | null;

type Store = {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  session: { email: string } | null;
  login: (email: string) => void;
  logout: () => void;
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  setLanguage: (lang: Lang) => void;
  contacts: Contact[];
  addContact: (c: Omit<Contact, "id" | "notes" | "timeline" | "createdAt">) => void;
  updateContact: (id: string, partial: Partial<Contact>) => void;
  addNote: (contactId: string, body: string) => void;
  opportunities: Opportunity[];
  addOpportunity: (o: Omit<Opportunity, "id" | "createdAt">) => void;
  moveOpportunity: (id: string, stage: Stage) => void;
  conversations: Conversation[];
  sendMessage: (conversationId: string, body: string) => void;
  markRead: (conversationId: string) => void;
  appointments: Appointment[];
  addAppointment: (a: Omit<Appointment, "id">) => void;
  activity: Activity[];
  socialConnections: SocialConnection[];
  connectSocial: (
    id: SocialNetworkId,
    data: {
      handle?: string;
      profileUrl?: string;
      accessToken?: string;
      pageId?: string;
    }
  ) => void;
  disconnectSocial: (id: SocialNetworkId) => void;
  updateSocialDraft: (
    id: SocialNetworkId,
    data: Partial<
      Pick<SocialConnection, "handle" | "profileUrl" | "accessToken" | "pageId">
    >
  ) => void;
  socialPosts: SocialPost[];
  mediaAssets: MediaAsset[];
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (id: string) => void;
  setMediaPreviewUrl: (id: string, previewUrl: string | undefined) => void;
  addSocialPost: (p: {
    body: string;
    channels: SocialNetworkId[];
    status: SocialPost["status"];
    scheduledAt: string | null;
    mediaIds?: string[];
  }) => void;
  smsCampaigns: SmsCampaign[];
  addSmsCampaign: (c: {
    name: string;
    body: string;
    audience: string;
    status: SmsCampaign["status"];
    scheduledAt: string | null;
  }) => void;
  emailCampaigns: EmailCampaign[];
  emailTemplates: EmailTemplate[];
  addEmailCampaign: (c: {
    name: string;
    subject: string;
    body: string;
    audience: string;
    templateId?: string;
    status: EmailCampaign["status"];
    scheduledAt: string | null;
  }) => void;
  integrations: Integrations;
  connectSms: (data: Omit<SmsIntegration, "connected">) => void;
  disconnectSms: () => void;
  connectEmail: (data: Omit<EmailIntegration, "connected">) => void;
  disconnectEmail: () => void;
  toast: Toast;
  showToast: (message: string) => void;
  clearToast: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  ensureSeed: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      session: null,
      login: (email) => set({ session: { email } }),
      logout: () => set({ session: null }),
      settings: defaultSettings,
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      setLanguage: (lang) =>
        set((s) => ({ settings: { ...s.settings, language: lang } })),
      contacts: [],
      addContact: (c) =>
        set((s) => ({
          contacts: [
            {
              ...c,
              id: uid(),
              notes: [],
              timeline: [
                {
                  id: uid(),
                  type: "note",
                  title: "Contact created",
                  createdAt: new Date().toISOString(),
                },
              ],
              createdAt: new Date().toISOString(),
            },
            ...s.contacts,
          ],
        })),
      updateContact: (id, partial) =>
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        })),
      addNote: (contactId, body) =>
        set((s) => ({
          contacts: s.contacts.map((c) => {
            if (c.id !== contactId) return c;
            const note: Note = {
              id: uid(),
              body,
              createdAt: new Date().toISOString(),
              author: "Demo User",
            };
            return {
              ...c,
              notes: [note, ...c.notes],
              timeline: [
                {
                  id: uid(),
                  type: "note" as const,
                  title: "Note added",
                  createdAt: note.createdAt,
                },
                ...c.timeline,
              ],
            };
          }),
        })),
      opportunities: [],
      addOpportunity: (o) =>
        set((s) => ({
          opportunities: [
            { ...o, id: uid(), createdAt: new Date().toISOString() },
            ...s.opportunities,
          ],
        })),
      moveOpportunity: (id, stage) =>
        set((s) => ({
          opportunities: s.opportunities.map((o) =>
            o.id === id
              ? {
                  ...o,
                  stage,
                  probability:
                    stage === "won" ? 100 : stage === "lost" ? 0 : o.probability,
                }
              : o
          ),
        })),
      conversations: [],
      sendMessage: (conversationId, body) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const msg = {
              id: uid(),
              body,
              fromMe: true,
              createdAt: new Date().toISOString(),
            };
            return {
              ...c,
              lastMessage: body,
              updatedAt: msg.createdAt,
              messages: [...c.messages, msg],
            };
          }),
        })),
      markRead: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, unread: 0 } : c
          ),
        })),
      appointments: [],
      addAppointment: (a) =>
        set((s) => ({
          appointments: [{ ...a, id: uid() }, ...s.appointments],
        })),
      activity: [],
      socialConnections: [],
      connectSocial: (id, data) =>
        set((s) => {
          const merged = mergeSocialConnections(s.socialConnections);
          const existing = merged.find((c) => c.id === id);
          const updated = buildConnectedSocial(id, existing, data);
          return {
            socialConnections: merged.map((c) =>
              c.id === id ? updated : c
            ),
          };
        }),
      disconnectSocial: (id) =>
        set((s) => {
          const merged = mergeSocialConnections(s.socialConnections);
          return {
            socialConnections: merged.map((c) =>
              c.id === id
                ? {
                    ...c,
                    connected: false,
                    accessToken: "",
                  }
                : c
            ),
          };
        }),
      updateSocialDraft: (id, data) =>
        set((s) => ({
          socialConnections: s.socialConnections.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        })),
      socialPosts: [],
      mediaAssets: [],
      addMediaAsset: (asset) =>
        set((s) => ({
          mediaAssets: [
            {
              id: asset.id,
              kind: asset.kind,
              name: asset.name,
              size: asset.size,
              mime: asset.mime,
              createdAt: asset.createdAt,
              previewUrl: asset.previewUrl,
              durationSec: asset.durationSec,
            },
            ...s.mediaAssets.filter((m) => m.id !== asset.id),
          ],
        })),
      removeMediaAsset: (id) =>
        set((s) => ({
          mediaAssets: s.mediaAssets.filter((m) => m.id !== id),
        })),
      setMediaPreviewUrl: (id, previewUrl) =>
        set((s) => ({
          mediaAssets: s.mediaAssets.map((m) =>
            m.id === id ? { ...m, previewUrl } : m
          ),
        })),
      addSocialPost: (p) =>
        set((s) => ({
          socialPosts: [
            {
              id: uid(),
              body: p.body,
              channels: p.channels,
              status: p.status,
              scheduledAt: p.scheduledAt,
              publishedAt:
                p.status === "published" ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
              mediaIds: p.mediaIds ?? [],
            },
            ...s.socialPosts,
          ],
        })),
      smsCampaigns: [],
      addSmsCampaign: (c) =>
        set((s) => ({
          smsCampaigns: [
            {
              id: uid(),
              name: c.name,
              body: c.body,
              audience: c.audience,
              status: c.status,
              sent: c.status === "sent" ? 1250 : 0,
              delivered: c.status === "sent" ? 1210 : 0,
              clicked: c.status === "sent" ? 186 : 0,
              createdAt: new Date().toISOString(),
              scheduledAt: c.scheduledAt,
            },
            ...s.smsCampaigns,
          ],
        })),
      emailCampaigns: [],
      emailTemplates: [],
      addEmailCampaign: (c) =>
        set((s) => ({
          emailCampaigns: [
            {
              id: uid(),
              name: c.name,
              subject: c.subject,
              body: c.body,
              audience: c.audience,
              templateId: c.templateId,
              status: c.status,
              sent: c.status === "sent" ? 2400 : 0,
              opened: c.status === "sent" ? 840 : 0,
              clicked: c.status === "sent" ? 210 : 0,
              createdAt: new Date().toISOString(),
              scheduledAt: c.scheduledAt,
            },
            ...s.emailCampaigns,
          ],
        })),
      integrations: defaultIntegrations,
      connectSms: (data) =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            sms: {
              connected: true,
              accountSid: data.accountSid.trim(),
              authToken: data.authToken.trim(),
              fromNumber: data.fromNumber.trim(),
            },
          },
        })),
      disconnectSms: () =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            sms: { ...defaultIntegrations.sms },
          },
        })),
      connectEmail: (data) =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            email: {
              connected: true,
              provider: data.provider,
              apiKey: data.apiKey.trim(),
              fromEmail: data.fromEmail.trim(),
              fromName: data.fromName.trim(),
            },
          },
        })),
      disconnectEmail: () =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            email: { ...defaultIntegrations.email },
          },
        })),
      toast: null,
      showToast: (message) => {
        const id = uid();
        set({ toast: { id, message } });
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null });
        }, 2800);
      },
      clearToast: () => set({ toast: null }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      ensureSeed: () => {
        const s = get();
        const patch: Partial<Store> = {};
        if (s.contacts.length === 0) {
          const contacts = createSeedContacts();
          patch.contacts = contacts;
          patch.opportunities = createSeedOpportunities(contacts);
          patch.conversations = createSeedConversations(contacts);
          patch.appointments = createSeedAppointments();
          patch.activity = createSeedActivity();
        }
        {
          const merged = mergeSocialConnections(s.socialConnections || []);
          const needsMerge =
            s.socialConnections.length === 0 ||
            s.socialConnections.length !== merged.length ||
            s.socialConnections.some(
              (c) =>
                c.profileUrl === undefined ||
                c.accessToken === undefined ||
                c.handle === undefined ||
                c.pageId === undefined
            );
          if (needsMerge) {
            patch.socialConnections = merged;
          }
        }
        if (s.socialPosts.length === 0) {
          patch.socialPosts = createSeedSocialPosts();
        } else if (s.socialPosts.some((p) => !Array.isArray(p.mediaIds))) {
          patch.socialPosts = s.socialPosts.map((p) => ({
            ...p,
            mediaIds: Array.isArray(p.mediaIds) ? p.mediaIds : [],
          }));
        }
        if (!Array.isArray(s.mediaAssets)) {
          patch.mediaAssets = [];
        }
        if (s.smsCampaigns.length === 0) {
          patch.smsCampaigns = createSeedSmsCampaigns();
        }
        if (s.emailTemplates.length === 0) {
          patch.emailTemplates = createSeedEmailTemplates();
        }
        if (s.emailCampaigns.length === 0) {
          patch.emailCampaigns = createSeedEmailCampaigns();
        }
        if (!s.integrations?.sms || !s.integrations?.email) {
          patch.integrations = {
            sms: { ...defaultIntegrations.sms, ...(s.integrations?.sms || {}) },
            email: {
              ...defaultIntegrations.email,
              ...(s.integrations?.email || {}),
            },
          };
        }
        if (Object.keys(patch).length) set(patch);
      },
    }),
    {
      name: "aiom-crm-demo",
      partialize: (s) => ({
        session: s.session,
        settings: s.settings,
        contacts: s.contacts,
        opportunities: s.opportunities,
        conversations: s.conversations,
        appointments: s.appointments,
        activity: s.activity,
        socialConnections: s.socialConnections,
        socialPosts: s.socialPosts,
        mediaAssets: (s.mediaAssets || []).map((m) => ({ id: m.id, kind: m.kind, name: m.name, size: m.size, mime: m.mime, createdAt: m.createdAt, durationSec: m.durationSec })),
        smsCampaigns: s.smsCampaigns,
        emailCampaigns: s.emailCampaigns,
        emailTemplates: s.emailTemplates,
        integrations: s.integrations,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (state.settings.language as string) === "de") {
          state.updateSettings({ language: "es" });
        }
        state?.setHydrated(true);
        state?.ensureSeed();
      },
    }
  )
);
