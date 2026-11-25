import type { Contact, CrmState, LeadAttribution } from "../types";
import { LANDING_BRAND, LANDING_SERVICES } from "./config";

const SERVICE_IDS = new Set<string>(LANDING_SERVICES.map((s) => s.id));

export type LandingFieldError =
  | "invalid_name"
  | "invalid_phone"
  | "invalid_email"
  | "invalid_service"
  | "invalid_message"
  | "consent_required";

export type LandingUtm = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

export type ValidLandingLead = {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  utm: LandingUtm;
};

export type LandingValidation =
  | { ok: true; spam: true }
  | { ok: true; spam: false; lead: ValidLandingLead }
  | { ok: false; error: LandingFieldError };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanUtm(value: unknown): string | undefined {
  const text = cleanText(value, 120);
  return text || undefined;
}

export function validateLandingLead(
  body: unknown,
  allowedServices?: readonly string[]
): LandingValidation {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "invalid_name" };

  const honeypot = cleanText(record.company_website ?? record.honeypot, 200);
  if (honeypot) return { ok: true, spam: true };

  const name = cleanText(record.name, 80);
  if (name.length < 2 || !/[A-Za-z\u00C0-\u024F]/.test(name)) {
    return { ok: false, error: "invalid_name" };
  }

  const phone = cleanText(record.phone, 40);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, error: "invalid_phone" };
  }

  const email = cleanText(record.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };

  const service = cleanText(record.service, 40);
  const allowed = new Set(
    (allowedServices && allowedServices.length ? allowedServices : Array.from(SERVICE_IDS)).map((id) =>
      id.trim().slice(0, 40)
    )
  );
  if (!allowed.has(service)) return { ok: false, error: "invalid_service" };

  const message = cleanText(record.message, 1000);
  if (typeof record.message === "string" && record.message.trim().length > 1000) {
    return { ok: false, error: "invalid_message" };
  }

  if (record.consent !== true) return { ok: false, error: "consent_required" };

  const utmRecord = asRecord(record.utm) ?? {};
  const utm: LandingUtm = {
    source: cleanUtm(utmRecord.source),
    medium: cleanUtm(utmRecord.medium),
    campaign: cleanUtm(utmRecord.campaign),
    content: cleanUtm(utmRecord.content),
    term: cleanUtm(utmRecord.term),
  };

  return {
    ok: true,
    spam: false,
    lead: {
      name,
      phone,
      email,
      service,
      message,
      utm,
    },
  };
}

export function serviceLabel(id: string, labels?: Record<string, string>): string {
  return labels?.[id] ?? LANDING_SERVICES.find((s) => s.id === id)?.label ?? id;
}

function attributionOf(lead: ValidLandingLead): LeadAttribution {
  const attribution: LeadAttribution = {
    page: "finanzas",
    service: lead.service,
  };
  if (lead.utm.source) attribution.utmSource = lead.utm.source;
  if (lead.utm.medium) attribution.utmMedium = lead.utm.medium;
  if (lead.utm.campaign) attribution.utmCampaign = lead.utm.campaign;
  if (lead.utm.content) attribution.utmContent = lead.utm.content;
  if (lead.utm.term) attribution.utmTerm = lead.utm.term;
  return attribution;
}

function attributionLine(attribution: LeadAttribution): string {
  const parts = [
    attribution.utmSource && `utm_source=${attribution.utmSource}`,
    attribution.utmMedium && `utm_medium=${attribution.utmMedium}`,
    attribution.utmCampaign && `utm_campaign=${attribution.utmCampaign}`,
    attribution.utmContent && `utm_content=${attribution.utmContent}`,
    attribution.utmTerm && `utm_term=${attribution.utmTerm}`,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "directa (sin UTM)";
}

export function buildLandingContact(
  lead: ValidLandingLead,
  now = new Date(),
  id?: string,
  labels?: Record<string, string>
): Contact {
  const parts = lead.name.split(" ").filter(Boolean);
  const firstName = parts[0] || lead.name;
  const lastName = parts.slice(1).join(" ");
  const createdAt = now.toISOString();
  const contactId =
    id ||
    `ld_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const label = serviceLabel(lead.service, labels);
  const attribution = attributionOf(lead);
  const note = [
    `Solicitud desde la landing «${LANDING_BRAND}».`,
    `Servicio de interés: ${label}`,
    lead.message ? `Mensaje: ${lead.message}` : "Mensaje: (sin mensaje)",
    "Consentimiento para contacto: sí",
    `Atribución: ${attributionLine(attribution)}`,
  ].join("\n");

  return {
    id: contactId,
    firstName,
    lastName,
    email: lead.email,
    phone: lead.phone,
    company: "",
    tags: ["landing", label],
    source: "landing",
    status: "lead",
    notes: [
      {
        id: `${contactId}-n`,
        body: note,
        createdAt,
        author: "Landing",
      },
    ],
    timeline: [
      {
        id: `${contactId}-t`,
        type: "note",
        title: `Lead desde landing · ${label}`,
        createdAt,
      },
    ],
    createdAt,
    attribution,
  };
}

export function landingActivity(contact: Contact) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return {
    id: `act-${contact.id}`,
    text: `Nuevo lead desde la landing — ${name}`,
    time: "Justo ahora",
    type: "lead",
  };
}

/**
 * Keeps landing contacts that arrived after this browser loaded the CRM.
 * A lead the client already had in `loadedLandingIds` can be deleted.
 * If the client omits the list, server-side landing leads are kept.
 */
export function mergeIncomingCrmState(
  existing: CrmState | null,
  incoming: CrmState,
  loadedLandingIds: string[] | null
): CrmState {
  const existingContacts = Array.isArray(existing?.contacts) ? existing.contacts : [];
  const incomingContacts = Array.isArray(incoming.contacts) ? incoming.contacts : [];
  const incomingIds = new Set(incomingContacts.map((c) => c.id));
  const known = loadedLandingIds ? new Set(loadedLandingIds) : null;
  const reinstate = existingContacts
    .filter((c) => {
      if (!c || c.source !== "landing" || incomingIds.has(c.id)) return false;
      if (!known) return true;
      return !known.has(c.id);
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!reinstate.length) return incoming;

  const reinstateIds = new Set(reinstate.map((c) => `act-${c.id}`));
  const existingActivity = Array.isArray(existing?.activity) ? existing.activity : [];
  const incomingActivity = Array.isArray(incoming.activity) ? incoming.activity : [];
  const keptActivity = existingActivity.filter((a) => reinstateIds.has(a.id));

  return {
    ...incoming,
    contacts: [...reinstate, ...incomingContacts],
    activity: [...keptActivity, ...incomingActivity].slice(0, 100),
  };
}
