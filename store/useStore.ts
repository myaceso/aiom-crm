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
  WhatsAppIntegration,
  TelegramIntegration,
  MessagingSend,
  SafeUser,
  Session,
  PermissionKey,
  UserRole,
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
  authReady: boolean;
  needsBootstrap: boolean;
  users: SafeUser[];
  session: Session | null;
  refreshAuth: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  bootstrapAdmin: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  currentUser: () => SafeUser | null;
  createUser: (data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    permissions: PermissionKey[];
  }) => Promise<{ ok: true; user: SafeUser } | { ok: false; error: string }>;
  updateUser: (
    id: string,
    partial: Partial<
      Pick<SafeUser, "name" | "email" | "role" | "permissions" | "active">
    > & { password?: string }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deactivateUser: (
    id: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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
  connectWhatsApp: (data: Omit<WhatsAppIntegration, "connected">) => void;
  disconnectWhatsApp: () => void;
  connectTelegram: (data: Omit<TelegramIntegration, "connected">) => void;
  disconnectTelegram: () => void;
  messagingSends: MessagingSend[];
  addMessagingSend: (s: Omit<MessagingSend, "id" | "createdAt">) => void;
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
      authReady: false,
      needsBootstrap: false,
      users: [],
      session: null,
      refreshAuth: async () => {
        try {
          const res = await fetch("/api/auth/me", {
            credentials: "include",
            cache: "no-store",
          });
          const data = await res.json();
          const user = (data?.user as SafeUser | null) || null;
          set({
            authReady: true,
            needsBootstrap: !!data?.needsBootstrap,
            session: user
              ? { userId: user.id, email: user.email }
              : null,
          });
          if (user) {
            set((s) => ({
              users: [
                user,
                ...s.users.filter((u) => u.id !== user.id),
              ],
            }));
            if (user.role === "admin") void get().fetchUsers();
          }
        } catch {
          set({ authReady: true, session: null, needsBootstrap: false });
        }
      },
      fetchUsers: async () => {
        try {
          const res = await fetch("/api/auth/users", {
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data?.users)) {
            set({ users: data.users as SafeUser[] });
          }
        } catch {
          /* ignore */
        }
      },
      bootstrapAdmin: async ({ name, email, password }) => {
        try {
          const res = await fetch("/api/auth/bootstrap", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false as const,
              error: (data?.error as string) || "invalid",
            };
          }
          const user = data.user as SafeUser;
          set({
            needsBootstrap: false,
            session: { userId: user.id, email: user.email },
            users: [user],
            authReady: true,
          });
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "server_error" };
        }
      },
      login: async (email, password) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false as const,
              error: (data?.error as string) || "invalid_credentials",
            };
          }
          const user = data.user as SafeUser;
          set({
            session: { userId: user.id, email: user.email },
            users: [user],
            authReady: true,
            needsBootstrap: false,
          });
          if (user.role === "admin") void get().fetchUsers();
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "server_error" };
        }
      },
      logout: async () => {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          });
        } catch {
          /* ignore */
        }
        set({ session: null });
      },
      currentUser: () => {
        const s = get();
        if (!s.session?.userId) return null;
        return s.users.find((u) => u.id === s.session!.userId) ?? null;
      },
      createUser: async ({
        name,
        email,
        password,
        role = "staff",
        permissions,
      }) => {
        try {
          const res = await fetch("/api/auth/users", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role, permissions }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false as const,
              error: (data?.error as string) || "forbidden",
            };
          }
          const user = data.user as SafeUser;
          set((s) => ({
            users: [...s.users.filter((u) => u.id !== user.id), user],
          }));
          return { ok: true as const, user };
        } catch {
          return { ok: false as const, error: "server_error" };
        }
      },
      updateUser: async (id, partial) => {
        try {
          const res = await fetch(`/api/auth/users/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(partial),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false as const,
              error: (data?.error as string) || "forbidden",
            };
          }
          const user = data.user as SafeUser;
          set((s) => ({
            users: s.users.map((u) => (u.id === id ? user : u)),
            session:
              s.session?.userId === id
                ? { userId: id, email: user.email }
                : s.session,
          }));
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "server_error" };
        }
      },
      deactivateUser: async (id) => {
        try {
          const res = await fetch(`/api/auth/users/${id}`, {
            method: "DELETE",
            credentials: "include",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false as const,
              error: (data?.error as string) || "forbidden",
            };
          }
          const user = data.user as SafeUser;
          set((s) => ({
            users: s.users.map((u) => (u.id === id ? user : u)),
            session: s.session?.userId === id ? null : s.session,
          }));
          return { ok: true as const };
        } catch {
          return { ok: false as const, error: "server_error" };
        }
      },
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
              author: get().currentUser()?.name || "User",
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
      connectWhatsApp: (data) =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            whatsapp: {
              connected: true,
              phoneNumberId: data.phoneNumberId.trim(),
              accessToken: data.accessToken.trim(),
              wabaId: (data.wabaId || "").trim(),
            },
          },
        })),
      disconnectWhatsApp: () =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            whatsapp: { ...defaultIntegrations.whatsapp },
          },
        })),
      connectTelegram: (data) =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            telegram: {
              connected: true,
              botToken: data.botToken.trim(),
              defaultChatId: (data.defaultChatId || "").trim(),
            },
          },
        })),
      disconnectTelegram: () =>
        set((s) => ({
          integrations: {
            ...s.integrations,
            telegram: { ...defaultIntegrations.telegram },
          },
        })),
      messagingSends: [],
      addMessagingSend: (entry) =>
        set((s) => ({
          messagingSends: [
            {
              ...entry,
              id: uid(),
              createdAt: new Date().toISOString(),
            },
            ...(s.messagingSends || []),
          ].slice(0, 50),
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
        if (
          !s.integrations?.sms ||
          !s.integrations?.email ||
          !s.integrations?.whatsapp ||
          !s.integrations?.telegram
        ) {
          patch.integrations = {
            sms: { ...defaultIntegrations.sms, ...(s.integrations?.sms || {}) },
            email: {
              ...defaultIntegrations.email,
              ...(s.integrations?.email || {}),
            },
            whatsapp: {
              ...defaultIntegrations.whatsapp,
              ...(s.integrations?.whatsapp || {}),
            },
            telegram: {
              ...defaultIntegrations.telegram,
              ...(s.integrations?.telegram || {}),
            },
          };
        }
        if (!Array.isArray(s.messagingSends)) {
          patch.messagingSends = [];
        }
        if (!Array.isArray(s.users)) {
          patch.users = [];
        }
        if (Object.keys(patch).length) set(patch);
      },
    }),
    {
      name: "enone-crm",
      partialize: (s) => ({
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
        messagingSends: s.messagingSends,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (state.settings.language as string) === "de") {
          state.updateSettings({ language: "es" });
        }
        if (state) {
          state.users = [];
          state.session = null;
          state.needsBootstrap = false;
          state.authReady = false;
        }
        state?.setHydrated(true);
        state?.ensureSeed();
        void state?.refreshAuth();
      },
    }
  )
);
