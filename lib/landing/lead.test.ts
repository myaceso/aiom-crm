import assert from "node:assert/strict";
import test from "node:test";
import { phoneHref, whatsappHref } from "./config.ts";
import {
  buildLandingContact,
  mergeIncomingCrmState,
  validateLandingLead,
} from "./lead.ts";
import type { Contact, CrmState } from "../types.ts";

const validBody = {
  name: "María López",
  phone: "(404) 555-0199",
  email: "maria@example.com",
  service: "credito",
  message: "Quiero revisar mi crédito.",
  consent: true,
  utm: {
    source: "instagram",
    medium: "paid",
    campaign: "abril",
    content: "historia",
    term: "credito",
  },
};

function contact(partial: Partial<Contact> & Pick<Contact, "id" | "source">): Contact {
  return {
    firstName: "Ana",
    lastName: "Ríos",
    email: "ana@example.com",
    phone: "4045550100",
    company: "",
    tags: [],
    status: "lead",
    notes: [],
    timeline: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function state(contacts: Contact[]): CrmState {
  return {
    settings: { companyName: "enone", primaryColor: "#6366f1", language: "es" },
    contacts,
    opportunities: [],
    conversations: [],
    appointments: [],
    activity: contacts.map((c) => ({
      id: `act-${c.id}`,
      text: c.firstName,
      time: "Justo ahora",
      type: "lead",
    })),
    socialConnections: [],
    socialPosts: [],
    mediaAssets: [],
    smsCampaigns: [],
    emailCampaigns: [],
    emailTemplates: [],
    integrations: {
      sms: { connected: false, accountSid: "", authToken: "", fromNumber: "" },
      email: { connected: false, provider: "resend", apiKey: "", fromEmail: "", fromName: "" },
      whatsapp: { connected: false, phoneNumberId: "", accessToken: "", wabaId: "" },
      telegram: { connected: false, botToken: "", defaultChatId: "" },
    },
    messagingSends: [],
  };
}

test("accepts a valid lead and stores source landing plus UTM", () => {
  const parsed = validateLandingLead(validBody);
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.spam) return;
  const lead = buildLandingContact(parsed.lead, new Date("2026-04-01T15:00:00.000Z"), "ld_test");
  assert.equal(lead.source, "landing");
  assert.equal(lead.status, "lead");
  assert.equal(lead.firstName, "María");
  assert.equal(lead.lastName, "López");
  assert.equal(lead.email, "maria@example.com");
  assert.deepEqual(lead.tags, ["landing", "Crédito"]);
  assert.equal(lead.attribution?.page, "finanzas");
  assert.equal(lead.attribution?.service, "credito");
  assert.equal(lead.attribution?.utmSource, "instagram");
  assert.equal(lead.attribution?.utmMedium, "paid");
  assert.equal(lead.attribution?.utmCampaign, "abril");
  assert.match(lead.notes[0].body, /utm_source=instagram/);
  assert.match(lead.notes[0].body, /Consentimiento para contacto: sí/);
});

test("rejects missing consent, bad email, unknown service, and long messages", () => {
  assert.equal(validateLandingLead({ ...validBody, consent: false }).ok, false);
  assert.equal(validateLandingLead({ ...validBody, email: "no-email" }).ok, false);
  assert.equal(validateLandingLead({ ...validBody, service: "hipoteca" }).ok, false);
  assert.equal(validateLandingLead({ ...validBody, phone: "123" }).ok, false);
  assert.equal(validateLandingLead({ ...validBody, name: " " }).ok, false);
  const long = validateLandingLead({ ...validBody, message: "a".repeat(1001) });
  assert.equal(long.ok, false);
  if (!long.ok) assert.equal(long.error, "invalid_message");
});

test("honeypot short-circuits as spam and does not build a lead", () => {
  const parsed = validateLandingLead({ ...validBody, company_website: "https://spam.test" });
  assert.deepEqual(parsed, { ok: true, spam: true });
});

test("placeholder phone and WhatsApp do not become links", () => {
  assert.equal(phoneHref({ phoneE164: "" }), null);
  assert.equal(whatsappHref({ whatsappE164: "000" }), null);
  assert.equal(phoneHref({ phoneE164: "14045550100" }), "tel:+14045550100");
  assert.match(whatsappHref({ whatsappE164: "+1 (404) 555-0100" }) || "", /^https:\/\/wa\.me\/14045550100/);
});

test("a stale CRM save keeps a landing lead the browser had not loaded", () => {
  const landing = contact({
    id: "ld_new",
    source: "landing",
    createdAt: "2026-04-02T00:00:00.000Z",
  });
  const existing = state([landing]);
  const incoming = state([contact({ id: "c1", source: "Organic", status: "active" })]);
  const merged = mergeIncomingCrmState(existing, incoming, []);
  assert.deepEqual(
    merged.contacts.map((c) => c.id),
    ["ld_new", "c1"]
  );
  assert.equal(merged.activity.some((a) => a.id === "act-ld_new"), true);
});

test("a landing lead the browser already loaded can be removed", () => {
  const landing = contact({ id: "ld_old", source: "landing" });
  const existing = state([landing, contact({ id: "c1", source: "Organic", status: "active" })]);
  const incoming = state([contact({ id: "c1", source: "Organic", status: "active" })]);
  const merged = mergeIncomingCrmState(existing, incoming, ["ld_old"]);
  assert.deepEqual(
    merged.contacts.map((c) => c.id),
    ["c1"]
  );
});

test("non-landing contacts are not resurrected, and an unknown client keeps landing leads", () => {
  const organic = contact({ id: "c-old", source: "Referral", status: "active" });
  const landing = contact({ id: "ld_keep", source: "landing" });
  const existing = state([landing, organic]);
  const incoming = state([]);
  const deleted = mergeIncomingCrmState(existing, incoming, ["ld_keep"]);
  assert.equal(deleted.contacts.length, 0);
  const preserved = mergeIncomingCrmState(existing, incoming, null);
  assert.deepEqual(
    preserved.contacts.map((c) => c.id),
    ["ld_keep"]
  );
});
