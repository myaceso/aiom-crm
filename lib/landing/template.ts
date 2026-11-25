import {
  LANDING_AREA,
  LANDING_BENEFITS,
  LANDING_BRAND,
  LANDING_CONTACT,
  LANDING_FAQ,
  LANDING_PATH,
  LANDING_SERVICES,
} from "./config";

export const LANDING_PAGE_ID = "finanzas";

export const LANDING_FONTS = [
  "Inter",
  "Outfit",
  "DM Sans",
  "Montserrat",
  "Poppins",
  "Sora",
  "Nunito",
  "Source Sans 3",
  "Bricolage Grotesque",
  "Playfair Display",
] as const;

export type LandingFont = (typeof LANDING_FONTS)[number];
export type LandingSize = "sm" | "md" | "lg" | "xl";
export type LandingWeight = "600" | "700" | "800";

export type LandingTheme = {
  accent: string;
  primary: string;
  background: string;
  headingFont: LandingFont;
  bodyFont: LandingFont;
  headingSize: LandingSize;
  bodySize: LandingSize;
  headingWeight: LandingWeight;
};

export type HeroSection = {
  id: string;
  type: "hero";
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
};

export type ServiceItem = { id: string; title: string; summary: string };
export type ServicesSection = {
  id: string;
  type: "services";
  heading: string;
  intro: string;
  items: ServiceItem[];
};

export type BenefitItem = { id: string; title: string; body: string };
export type BenefitsSection = {
  id: string;
  type: "benefits";
  heading: string;
  items: BenefitItem[];
};

export type FaqItem = { id: string; q: string; a: string };
export type FaqSection = { id: string; type: "faq"; heading: string; items: FaqItem[] };

export type ContactSection = { id: string; type: "contact"; heading: string; intro: string };

export type TextSection = { id: string; type: "text"; heading: string; body: string };
export type ImageSection = { id: string; type: "image"; url: string; alt: string; caption: string };
export type CtaSection = {
  id: string;
  type: "cta";
  heading: string;
  body: string;
  label: string;
  href: string;
};

export type LandingSection =
  | HeroSection
  | ServicesSection
  | BenefitsSection
  | FaqSection
  | ContactSection
  | TextSection
  | ImageSection
  | CtaSection;

export type LandingSectionType = LandingSection["type"];

export type LandingTemplate = {
  id: string;
  path: string;
  brand: string;
  area: string;
  headerCta: string;
  phoneDisplay: string;
  phoneE164: string;
  whatsappDisplay: string;
  whatsappE164: string;
  theme: LandingTheme;
  sections: LandingSection[];
};

const SIZES = new Set<LandingSize>(["sm", "md", "lg", "xl"]);
const WEIGHTS = new Set<LandingWeight>(["600", "700", "800"]);
const FONTS = new Set<string>(LANDING_FONTS);
const HEX = /^#[0-9a-fA-F]{6}$/;

export const HERO_TITLE_CLASS: Record<LandingSize, string> = {
  sm: "text-3xl sm:text-5xl",
  md: "text-4xl sm:text-6xl",
  lg: "text-5xl sm:text-7xl",
  xl: "text-5xl sm:text-8xl",
};

export const SECTION_TITLE_CLASS: Record<LandingSize, string> = {
  sm: "text-xl sm:text-2xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl",
  xl: "text-4xl sm:text-5xl",
};

export const LEAD_CLASS: Record<LandingSize, string> = {
  sm: "text-sm leading-6 sm:text-base",
  md: "text-base leading-7 sm:text-lg",
  lg: "text-lg leading-8 sm:text-xl",
  xl: "text-xl leading-8 sm:text-2xl",
};

export const CARD_CLASS: Record<LandingSize, string> = {
  sm: "text-xs leading-5 sm:text-sm",
  md: "text-sm leading-6",
  lg: "text-base leading-7",
  xl: "text-lg leading-8",
};

function nid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultLandingTemplate(): LandingTemplate {
  return {
    id: LANDING_PAGE_ID,
    path: LANDING_PATH,
    brand: LANDING_BRAND,
    area: LANDING_AREA,
    headerCta: "Contactar",
    phoneDisplay: LANDING_CONTACT.phoneDisplay,
    phoneE164: LANDING_CONTACT.phoneE164,
    whatsappDisplay: LANDING_CONTACT.whatsappDisplay,
    whatsappE164: LANDING_CONTACT.whatsappE164,
    theme: {
      accent: "#FFC72C",
      primary: "#0f172a",
      background: "#fffdf8",
      headingFont: "Inter",
      bodyFont: "Inter",
      headingSize: "md",
      bodySize: "md",
      headingWeight: "600",
    },
    sections: [
      {
        id: "hero",
        type: "hero",
        eyebrow: LANDING_AREA,
        title: "Ordena tu dinero con alguien que te habla claro",
        highlight: "",
        subtitle:
          "Seguros de vida, préstamos, crédito, impuestos y ahorro para personas y negocios. En español, sin presión y sin prometer una aprobación.",
        primaryCta: "Quiero que me contacten",
        secondaryCta: "Ver servicios",
      },
      {
        id: "services",
        type: "services",
        heading: "Cómo podemos ayudarte",
        intro: "Elige el tema que te urge hoy. En la conversación vemos si encaja y qué sigue.",
        items: LANDING_SERVICES.map((item) => ({
          id: item.id,
          title: item.label,
          summary: item.summary,
        })),
      },
      {
        id: "benefits",
        type: "benefits",
        heading: "Por qué hablar con nosotros",
        items: LANDING_BENEFITS.map((item, index) => ({
          id: `benefit-${index + 1}`,
          title: item.title,
          body: item.body,
        })),
      },
      {
        id: "faq",
        type: "faq",
        heading: "Preguntas frecuentes",
        items: LANDING_FAQ.map((item, index) => ({
          id: `faq-${index + 1}`,
          q: item.q,
          a: item.a,
        })),
      },
      {
        id: "contact",
        type: "contact",
        heading: "Cuéntanos qué necesitas",
        intro:
          "Déjanos tu nombre, teléfono y el servicio. Te contactamos para escuchar tu caso. No hace falta que tengas todos los papeles a la mano.",
      },
    ],
  };
}

export function blankSection(type: LandingSectionType): LandingSection {
  const id = nid(type);
  switch (type) {
    case "hero":
      return {
        id,
        type,
        eyebrow: "",
        title: "Nuevo titular",
        highlight: "",
        subtitle: "",
        primaryCta: "Quiero que me contacten",
        secondaryCta: "Ver servicios",
      };
    case "services":
      return {
        id,
        type,
        heading: "Servicios",
        intro: "",
        items: [{ id: nid("svc"), title: "Nuevo servicio", summary: "" }],
      };
    case "benefits":
      return {
        id,
        type,
        heading: "Beneficios",
        items: [{ id: nid("ben"), title: "Nuevo beneficio", body: "" }],
      };
    case "faq":
      return {
        id,
        type,
        heading: "Preguntas",
        items: [{ id: nid("faq"), q: "¿Nueva pregunta?", a: "" }],
      };
    case "contact":
      return { id: "contact", type, heading: "Cuéntanos qué necesitas", intro: "" };
    case "text":
      return { id, type, heading: "Texto", body: "" };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "cta":
      return { id, type, heading: "Siguiente paso", body: "", label: "Contactar", href: "#contacto" };
  }
}

function text(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[<>]/g, "").trim().slice(0, max);
}

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

function fontOf(value: unknown, fallback: LandingFont): LandingFont {
  return typeof value === "string" && FONTS.has(value) ? (value as LandingFont) : fallback;
}

function sizeOf(value: unknown, fallback: LandingSize): LandingSize {
  return typeof value === "string" && SIZES.has(value as LandingSize) ? (value as LandingSize) : fallback;
}

function weightOf(value: unknown, fallback: LandingWeight): LandingWeight {
  return typeof value === "string" && WEIGHTS.has(value as LandingWeight)
    ? (value as LandingWeight)
    : fallback;
}

export function safeHref(value: unknown): string {
  const raw = text(value, 300);
  if (!raw) return "#contacto";
  if (raw.startsWith("#") && /^#[A-Za-z0-9_-]{1,40}$/.test(raw)) return raw;
  if (/^mailto:[^\s]+$/i.test(raw)) return raw;
  if (/^tel:\+?[0-9]{10,15}$/.test(raw.replace(/[\s()-]/g, ""))) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    /* ignore */
  }
  return "#contacto";
}

function safeImage(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.toString();
  } catch {
    /* ignore */
  }
  return "";
}

function slugId(value: unknown, fallback: string): string {
  const raw = text(value, 40).toLowerCase();
  const slug = raw.replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return slug || fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sanitizeSection(value: unknown, fallbackContact: ContactSection): LandingSection | null {
  const record = asRecord(value);
  if (!record || typeof record.type !== "string") return null;
  const id = slugId(record.id, nid("sec"));
  switch (record.type) {
    case "hero":
      return {
        id,
        type: "hero",
        eyebrow: text(record.eyebrow, 80),
        title: text(record.title, 180, "Titular"),
        highlight: text(record.highlight, 80),
        subtitle: text(record.subtitle, 600),
        primaryCta: text(record.primaryCta, 60, "Quiero que me contacten"),
        secondaryCta: text(record.secondaryCta, 60),
      };
    case "services": {
      const items = Array.isArray(record.items) ? record.items : [];
      return {
        id,
        type: "services",
        heading: text(record.heading, 120, "Servicios"),
        intro: text(record.intro, 400),
        items: items.slice(0, 12).map((item, index) => {
          const row = asRecord(item) ?? {};
          return {
            id: slugId(row.id, `svc-${index + 1}`),
            title: text(row.title, 80, "Servicio"),
            summary: text(row.summary, 400),
          };
        }),
      };
    }
    case "benefits": {
      const items = Array.isArray(record.items) ? record.items : [];
      return {
        id,
        type: "benefits",
        heading: text(record.heading, 120, "Beneficios"),
        items: items.slice(0, 12).map((item, index) => {
          const row = asRecord(item) ?? {};
          return {
            id: slugId(row.id, `ben-${index + 1}`),
            title: text(row.title, 80, "Beneficio"),
            body: text(row.body, 400),
          };
        }),
      };
    }
    case "faq": {
      const items = Array.isArray(record.items) ? record.items : [];
      return {
        id,
        type: "faq",
        heading: text(record.heading, 120, "Preguntas"),
        items: items.slice(0, 16).map((item, index) => {
          const row = asRecord(item) ?? {};
          return {
            id: slugId(row.id, `faq-${index + 1}`),
            q: text(row.q, 180, "Pregunta"),
            a: text(row.a, 600),
          };
        }),
      };
    }
    case "contact":
      return {
        id: "contact",
        type: "contact",
        heading: text(record.heading, 120, fallbackContact.heading),
        intro: text(record.intro, 600, fallbackContact.intro),
      };
    case "text":
      return { id, type: "text", heading: text(record.heading, 120), body: text(record.body, 2000) };
    case "image":
      return {
        id,
        type: "image",
        url: safeImage(record.url),
        alt: text(record.alt, 140),
        caption: text(record.caption, 180),
      };
    case "cta":
      return {
        id,
        type: "cta",
        heading: text(record.heading, 120),
        body: text(record.body, 400),
        label: text(record.label, 60, "Contactar"),
        href: safeHref(record.href),
      };
    default:
      return null;
  }
}

export function sanitizeLandingTemplate(input: unknown): LandingTemplate {
  const base = defaultLandingTemplate();
  const record = asRecord(input);
  if (!record) return base;
  const theme = asRecord(record.theme) ?? {};
  const contactFallback = base.sections.find((section) => section.type === "contact") as ContactSection;
  const sections = (Array.isArray(record.sections) ? record.sections : [])
    .slice(0, 24)
    .map((section) => sanitizeSection(section, contactFallback))
    .filter((section): section is LandingSection => !!section);
  const withoutExtraContacts = sections.filter((section, index) => {
    if (section.type !== "contact") return true;
    return sections.findIndex((item) => item.type === "contact") === index;
  });
  if (!withoutExtraContacts.some((section) => section.type === "contact")) {
    withoutExtraContacts.push(contactFallback);
  }
  return {
    id: LANDING_PAGE_ID,
    path: LANDING_PATH,
    brand: text(record.brand, 80, base.brand),
    area: text(record.area, 80, base.area),
    headerCta: text(record.headerCta, 40, base.headerCta),
    phoneDisplay: text(record.phoneDisplay, 80, base.phoneDisplay),
    phoneE164: text(record.phoneE164, 20).replace(/[^\d]/g, "").slice(0, 15),
    whatsappDisplay: text(record.whatsappDisplay, 80, base.whatsappDisplay),
    whatsappE164: text(record.whatsappE164, 20).replace(/[^\d]/g, "").slice(0, 15),
    theme: {
      accent: hex(theme.accent, base.theme.accent),
      primary: hex(theme.primary, base.theme.primary),
      background: hex(theme.background, base.theme.background),
      headingFont: fontOf(theme.headingFont, base.theme.headingFont),
      bodyFont: fontOf(theme.bodyFont, base.theme.bodyFont),
      headingSize: sizeOf(theme.headingSize, base.theme.headingSize),
      bodySize: sizeOf(theme.bodySize, base.theme.bodySize),
      headingWeight: weightOf(theme.headingWeight, base.theme.headingWeight),
    },
    sections: withoutExtraContacts,
  };
}

export function moveSection(sections: LandingSection[], index: number, direction: -1 | 1): LandingSection[] {
  const next = index + direction;
  if (index < 0 || index >= sections.length || next < 0 || next >= sections.length) return sections;
  const copy = sections.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function serviceChoices(template: LandingTemplate): { id: string; title: string }[] {
  const section = template.sections.find((item) => item.type === "services");
  if (section && section.type === "services" && section.items.length) {
    return section.items.map((item) => ({ id: item.id, title: item.title }));
  }
  return LANDING_SERVICES.map((item) => ({ id: item.id, title: item.label }));
}

export function googleFontsHref(theme: LandingTheme): string {
  const families = Array.from(new Set([theme.headingFont, theme.bodyFont]));
  const query = families
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
