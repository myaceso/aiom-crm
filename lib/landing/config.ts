/**
 * Plantilla pública registrada en Sitios → «Finanzas para negocios y personas».
 * Ruta: /finanzas
 *
 * TELÉFONO Y WHATSAPP: edita solo `LANDING_CONTACT`.
 * Deja `phoneE164` y `whatsappE164` vacíos hasta tener el número real.
 * No pongas aquí teléfonos, direcciones, licencias ni testimonios inventados.
 */
export const LANDING_PATH = "/finanzas";

export const LANDING_BRAND = "Finanzas para negocios y personas";

export const LANDING_AREA = "Atlanta, Georgia";

export const LANDING_CONTACT = {
  /** Texto visible. Sustituye el placeholder por el teléfono real. */
  phoneDisplay: "[PLACEHOLDER: teléfono]",
  /** Solo dígitos, con código de país (ej. 14045550100). Vacío = sin enlace tel:. */
  phoneE164: "",
  /** Texto visible. Sustituye el placeholder por el WhatsApp real. */
  whatsappDisplay: "[PLACEHOLDER: WhatsApp]",
  /** Solo dígitos, sin + ni espacios, para https://wa.me/. Vacío = sin enlace. */
  whatsappE164: "",
} as const;

export const LANDING_SERVICES = [
  {
    id: "seguros-de-vida",
    label: "Seguros de vida",
    summary:
      "Protección para tu familia o para una persona clave de tu negocio. Te explicamos qué cubre una póliza y qué preguntar antes de decidir.",
  },
  {
    id: "prestamos",
    label: "Préstamos",
    summary:
      "Orientación para entender opciones de financiamiento, requisitos habituales y qué documentos suelen pedir. Sin prometer una aprobación.",
  },
  {
    id: "credito",
    label: "Crédito",
    summary:
      "Ayuda para leer tu crédito y ordenar los hábitos que lo cuidan. Hablamos claro, sin atajos milagrosos.",
  },
  {
    id: "impuestos",
    label: "Impuestos",
    summary:
      "Preparación de impuestos para personas y pequeños negocios, con tiempo para explicar cada paso antes de presentarlo.",
  },
  {
    id: "ahorro",
    label: "Ahorro y planificación",
    summary:
      "Un plan sencillo para guardar dinero y ordenar metas, según lo que de verdad entra y sale en tu casa o tu negocio.",
  },
] as const;

export type LandingServiceId = (typeof LANDING_SERVICES)[number]["id"];

export const LANDING_BENEFITS = [
  {
    title: "En español, con calma",
    body: "Explicamos con palabras sencillas. Puedes preguntar las veces que haga falta.",
  },
  {
    title: "Personas y negocios",
    body: "Lo mismo si eres una familia, trabajas por tu cuenta o tienes un negocio pequeño.",
  },
  {
    title: "Varios temas, un solo lugar",
    body: "Seguros de vida, préstamos, crédito, impuestos y ahorro, sin mandarte de oficina en oficina para empezar.",
  },
  {
    title: "Tú marcas el paso",
    body: "La primera conversación sirve para entender tu caso. Nadie te apura a firmar el mismo día.",
  },
] as const;

export const LANDING_FAQ = [
  {
    q: "¿En qué zona atienden?",
    a: "Trabajamos con personas y negocios del área de Atlanta, Georgia. Si no puedes venir, la primera conversación puede ser por teléfono.",
  },
  {
    q: "¿Qué servicios puedo pedir?",
    a: "Seguros de vida, préstamos, ayuda con tu crédito, preparación de impuestos y ahorro o planificación. Elige uno en el formulario y cuéntanos tu caso.",
  },
  {
    q: "¿La solicitud por esta página tiene costo?",
    a: "Enviar el formulario no tiene costo. Si un servicio tiene tarifa, te la decimos antes de empezar.",
  },
  {
    q: "¿Qué pasa con mis datos?",
    a: "Los guardamos en nuestro CRM para contactarte sobre lo que pediste. No los vendemos ni los usamos para otra cosa.",
  },
  {
    q: "¿Me garantizan un préstamo o una póliza?",
    a: "No. Cada caso se revisa por separado. Nadie puede prometer una aprobación por este formulario.",
  },
] as const;

export function phoneHref(contact: { phoneE164: string } = LANDING_CONTACT): string | null {
  const digits = contact.phoneE164.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `tel:+${digits}`;
}

export function whatsappHref(
  contact: { whatsappE164: string } = LANDING_CONTACT
): string | null {
  const digits = contact.whatsappE164.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  const text = encodeURIComponent(
    "Hola, vi su página y quiero información sobre sus servicios."
  );
  return `https://wa.me/${digits}?text=${text}`;
}
