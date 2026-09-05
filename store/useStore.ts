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
} from "@/lib/types";
import {
  createSeedContacts,
  createSeedOpportunities,
  createSeedConversations,
  createSeedAppointments,
  createSeedActivity,
  defaultSettings,
} from "@/lib/seed";

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
  toast: Toast;
  showToast: (message: string) => void;
  clearToast: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
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
            o.id === id ? { ...o, stage, probability: stage === "won" ? 100 : stage === "lost" ? 0 : o.probability } : o
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
      ensureSeed: () => {
        const s = get();
        if (s.contacts.length === 0) {
          const contacts = createSeedContacts();
          set({
            contacts,
            opportunities: createSeedOpportunities(contacts),
            conversations: createSeedConversations(contacts),
            appointments: createSeedAppointments(),
            activity: createSeedActivity(),
          });
        }
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
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        state?.ensureSeed();
      },
    }
  )
);
