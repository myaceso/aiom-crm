"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BadgeCheck,
  HeartHandshake,
  Landmark,
  PiggyBank,
  Receipt,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { phoneHref, whatsappHref } from "@/lib/landing/config";
import {
  CARD_CLASS,
  HERO_TITLE_CLASS,
  LEAD_CLASS,
  SECTION_TITLE_CLASS,
  defaultLandingTemplate,
  googleFontsHref,
  formServiceOptions,
  type LandingSection,
  type LandingTemplate,
} from "@/lib/landing/template";

const ICONS: LucideIcon[] = [Shield, Landmark, BadgeCheck, Receipt, PiggyBank];

const ERRORS: Record<string, string> = {
  invalid_name: "Escribe tu nombre completo.",
  invalid_phone: "Escribe un teléfono válido, con código de área.",
  invalid_email: "Escribe un correo electrónico válido.",
  invalid_service: "Elige al menos un servicio.",
  invalid_message: "El mensaje es demasiado largo.",
  consent_required: "Necesitamos tu permiso para contactarte.",
  too_many: "Enviaste varias solicitudes. Espera unos minutos e inténtalo de nuevo.",
  unavailable: "Ahora no pudimos guardar tu solicitud. Inténtalo de nuevo en un momento.",
};

type Utm = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
};

function readUtm(): Utm {
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string) => (params.get(key) || "").slice(0, 120);
  return {
    source: pick("utm_source"),
    medium: pick("utm_medium"),
    campaign: pick("utm_campaign"),
    content: pick("utm_content"),
    term: pick("utm_term"),
  };
}

function ContactChip({
  label,
  display,
  href,
  accent,
  field,
}: {
  label: string;
  display: string;
  href: string | null;
  accent: string;
  field?: string;
}) {
  const className =
    "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-[#0f172a]";
  const inner = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {label}
      </span>
      <span className="truncate">{display}</span>
    </>
  );
  const fieldAttr = field ? { "data-edit-field": field } : {};
  if (!href) {
    return (
      <span className={className} style={{ borderStyle: "dashed", borderColor: accent, background: "#fffaf0" }} {...fieldAttr}>
        {inner}
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={`${className} bg-white`}
      style={{ borderColor: accent }}
      {...fieldAttr}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

function TitleWithHighlight({ title, highlight, accent }: { title: string; highlight: string; accent: string }) {
  if (!highlight || !title.includes(highlight)) return <>{title}</>;
  const index = title.indexOf(highlight);
  return (
    <>
      {title.slice(0, index)}
      <span style={{ color: accent }}>{highlight}</span>
      {title.slice(index + highlight.length)}
    </>
  );
}

export type PreviewPick = { sectionId: string; field?: string };

const PREVIEW_LABEL: Record<LandingSection["type"], string> = {
  hero: "Hero",
  services: "Servicios",
  benefits: "Beneficios",
  faq: "Preguntas",
  contact: "Formulario",
  text: "Texto",
  image: "Imagen",
  cta: "Botón",
};

export default function FinanzasLanding({
  template = defaultLandingTemplate(),
  embedded = false,
  onInspect,
}: {
  template?: LandingTemplate;
  embedded?: boolean;
  /** Solo el editor lo pasa. La página pública no recibe handlers ni contornos. */
  onInspect?: (pick: PreviewPick) => void;
}) {
  const tel = phoneHref({ phoneE164: template.phoneE164 });
  const wa = whatsappHref({ whatsappE164: template.whatsappE164 });
  const formOptions = formServiceOptions(template);
  const choices = formOptions.options;
  const allowMultiple = formOptions.allowMultiple;
  const theme = template.theme;
  const headingStyle = {
    fontFamily: `"${theme.headingFont}", Inter, sans-serif`,
    fontWeight: Number(theme.headingWeight),
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = embedded ? "lp-fonts-preview" : "lp-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontsHref(theme);
  }, [embedded, theme]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError(ERRORS.invalid_name);
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError(ERRORS.invalid_phone);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(ERRORS.invalid_email);
      return;
    }
    if (!services.length) {
      setError(ERRORS.invalid_service);
      return;
    }
    if (message.trim().length > 1000) {
      setError(ERRORS.invalid_message);
      return;
    }
    if (!consent) {
      setError(ERRORS.consent_required);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/landing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          service: services[0],
          services,
          message,
          consent,
          company_website: honeypot,
          utm: readUtm(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[data?.error as string] || ERRORS.unavailable);
        return;
      }
      setDone(true);
    } catch {
      setError(ERRORS.unavailable);
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-[#0f172a] outline-none placeholder:text-slate-400 focus:ring-2";
  const mark = (field: string) => (onInspect ? { "data-edit-field": field } : {});

  function renderSection(section: LandingSection) {
    if (section.type === "hero") {
      return (
        <section key={section.id} className="relative overflow-hidden text-white" style={{ background: theme.primary }}>
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: theme.accent, opacity: 0.25 }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full" style={{ background: theme.accent }} />
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            {section.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm" style={{ color: theme.accent }} {...mark("eyebrow")}>
                {section.eyebrow}
              </p>
            )}
            <h1 className={`mt-3 max-w-3xl leading-[1.1] tracking-tight text-white ${HERO_TITLE_CLASS[theme.headingSize]}`} style={headingStyle} {...mark("title")}>
              <TitleWithHighlight title={section.title} highlight={section.highlight} accent={theme.accent} />
            </h1>
            {section.subtitle && (
              <p className={`mt-5 max-w-2xl text-slate-200 ${LEAD_CLASS[theme.bodySize]}`} {...mark("subtitle")}>{section.subtitle}</p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {section.primaryCta && (
                <a href="#contacto" className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold" style={{ background: theme.accent, color: theme.primary }} {...mark("primaryCta")}>
                  {section.primaryCta}
                </a>
              )}
              {section.secondaryCta && (
                <a href="#servicios" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 text-base font-semibold text-white" {...mark("secondaryCta")}>
                  {section.secondaryCta}
                </a>
              )}
            </div>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <ContactChip label="Teléfono" display={template.phoneDisplay} href={tel} accent={theme.accent} field={onInspect ? "phoneDisplay" : undefined} />
              <ContactChip label="WhatsApp" display={template.whatsappDisplay} href={wa} accent={theme.accent} field={onInspect ? "whatsappDisplay" : undefined} />
            </div>
          </div>
        </section>
      );
    }
    if (section.type === "services") {
      return (
        <section id="servicios" key={section.id} className="scroll-mt-20 mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={{ ...headingStyle, color: theme.primary }} {...mark("heading")}>
            {section.heading}
          </h2>
          {section.intro && <p className={`mt-2 max-w-2xl text-slate-600 ${LEAD_CLASS[theme.bodySize]}`} {...mark("intro")}>{section.intro}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <article key={item.id} className="rounded-2xl border border-[#f0e6c8] bg-white p-5 shadow-card" {...mark(`svc:${item.id}:title`)}>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: theme.accent, color: theme.primary }}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg" style={{ ...headingStyle, color: theme.primary }} {...mark(`svc:${item.id}:title`)}>{item.title}</h3>
                  <p className={`mt-2 text-slate-600 ${CARD_CLASS[theme.bodySize]}`} {...mark(`svc:${item.id}:summary`)}>{item.summary}</p>
                </article>
              );
            })}
          </div>
        </section>
      );
    }
    if (section.type === "benefits") {
      return (
        <section key={section.id} className="text-white" style={{ background: theme.primary }}>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
            <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={headingStyle} {...mark("heading")}>{section.heading}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5" {...mark(`ben:${item.id}:title`)}>
                  <HeartHandshake className="h-5 w-5" style={{ color: theme.accent }} aria-hidden="true" />
                  <h3 className="mt-3 text-lg" style={headingStyle} {...mark(`ben:${item.id}:title`)}>{item.title}</h3>
                  <p className={`mt-2 text-slate-300 ${CARD_CLASS[theme.bodySize]}`} {...mark(`ben:${item.id}:body`)}>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    }
    if (section.type === "faq") {
      return (
        <section key={section.id} className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={{ ...headingStyle, color: theme.primary }} {...mark("heading")}>
            {section.heading}
          </h2>
          <div className="mt-6 divide-y divide-[#f0e6c8] overflow-hidden rounded-2xl border border-[#f0e6c8] bg-white">
            {section.items.map((item) => (
              <details key={item.id} className="group px-5 py-1" {...mark(`faq:${item.id}:q`)}>
                <summary
                  className="cursor-pointer list-none py-4 text-base font-semibold [&::-webkit-details-marker]:hidden"
                  style={{ color: theme.primary }}
                  {...mark(`faq:${item.id}:q`)}
                  onClick={onInspect ? (event) => event.preventDefault() : undefined}
                >
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="group-open:rotate-45" style={{ color: theme.accent }} aria-hidden="true">+</span>
                  </span>
                </summary>
                <p className={`pb-4 text-slate-600 ${CARD_CLASS[theme.bodySize]}`} {...mark(`faq:${item.id}:a`)}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    if (section.type === "text") {
      return (
        <section key={section.id} className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          {section.heading && (
            <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={{ ...headingStyle, color: theme.primary }} {...mark("heading")}>
              {section.heading}
            </h2>
          )}
          {section.body && <p className={`mt-3 max-w-3xl whitespace-pre-wrap text-slate-600 ${LEAD_CLASS[theme.bodySize]}`} {...mark("body")}>{section.body}</p>}
        </section>
      );
    }
    if (section.type === "image") {
      if (!section.url && !onInspect) return null;
      return (
        <section key={section.id} className="mx-auto max-w-6xl px-4 py-10" {...mark("url")}>
          {section.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.url} alt={section.alt || ""} className="max-h-[28rem] w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">Imagen</div>
          )}
          {section.caption && <p className="mt-2 text-sm text-slate-500" {...mark("caption")}>{section.caption}</p>}
        </section>
      );
    }
    if (section.type === "cta") {
      return (
        <section key={section.id} className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-16">
          <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={{ ...headingStyle, color: theme.primary }} {...mark("heading")}>{section.heading}</h2>
          {section.body && <p className={`mx-auto mt-3 max-w-2xl text-slate-600 ${LEAD_CLASS[theme.bodySize]}`} {...mark("body")}>{section.body}</p>}
          <a href={section.href} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold" style={{ background: theme.accent, color: theme.primary }} {...mark("label")}>
            {section.label}
          </a>
        </section>
      );
    }
    return (
      <section id="contacto" key={section.id} className="scroll-mt-20" style={{ background: "#fff6d8" }}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className={`tracking-tight ${SECTION_TITLE_CLASS[theme.headingSize]}`} style={{ ...headingStyle, color: theme.primary }} {...mark("heading")}>
              {section.heading}
            </h2>
            <p className={`mt-3 text-slate-700 ${LEAD_CLASS[theme.bodySize]}`} {...mark("intro")}>{section.intro}</p>
            <div className="mt-6 flex flex-col gap-2">
              <ContactChip label="Teléfono" display={template.phoneDisplay} href={tel} accent={theme.accent} />
              <ContactChip label="WhatsApp" display={template.whatsappDisplay} href={wa} accent={theme.accent} />
            </div>
          </div>
          <div className="rounded-3xl border border-[#f0e6c8] bg-white p-5 shadow-card sm:p-7">
            {done ? (
              <div role="status" className="py-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>Listo</p>
                <h3 className="mt-2 text-2xl" style={{ ...headingStyle, color: theme.primary }}>Recibimos tu solicitud</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
                  Te contactaremos pronto al teléfono o al correo que nos dejaste.
                </p>
              </div>
            ) : (
              <form onSubmit={onInspect ? (event) => event.preventDefault() : onSubmit} className="relative space-y-4" noValidate>
                <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label>
                    Sitio web
                    <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="company_website" />
                  </label>
                </div>
                <label className="block text-sm font-semibold" style={{ color: theme.primary }}>
                  Nombre
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} placeholder="Tu nombre" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold" style={{ color: theme.primary }}>
                    Teléfono
                    <input required type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} placeholder="Tu número con código de área" />
                  </label>
                  <label className="block text-sm font-semibold" style={{ color: theme.primary }}>
                    Correo
                    <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} placeholder="tu@correo.com" />
                  </label>
                </div>
                <fieldset className="border-0 p-0" {...mark("options")}>
                  <legend className="text-sm font-semibold" style={{ color: theme.primary }}>
                    {allowMultiple ? "Servicios de interés" : "Servicio de interés"}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2" role={allowMultiple ? "group" : "radiogroup"} aria-label="Servicios">
                    {choices.map((item) => {
                      const selected = services.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setServices((current) => {
                              if (!allowMultiple) return current[0] === item.id ? [] : [item.id];
                              return current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id];
                            })
                          }
                          className="min-h-11 rounded-full border px-4 text-sm font-semibold"
                          style={
                            selected
                              ? { background: theme.accent, borderColor: theme.accent, color: theme.primary }
                              : { background: "#fff", borderColor: "#e2e8f0", color: "#334155" }
                          }
                        >
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {allowMultiple ? "Puedes marcar más de uno." : "Elige uno."}
                  </p>
                </fieldset>
                <label className="block text-sm font-semibold" style={{ color: theme.primary }}>
                  Mensaje
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000} className={fieldClass} placeholder="Cuéntanos, en pocas líneas, qué estás buscando." />
                </label>
                <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" style={{ accentColor: theme.primary }} />
                  <span>Acepto que me contacten sobre el servicio que elegí. Mis datos se usan solo para esta solicitud.</span>
                </label>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base font-semibold disabled:opacity-60" style={{ background: theme.accent, color: theme.primary }}>
                  {busy ? "Enviando…" : "Enviar solicitud"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      {...(embedded ? {} : { "data-landing": "finanzas" })}
      className={`min-h-screen text-[#334155] ${onInspect ? "lp-inspect" : ""}`}
      style={{ background: theme.background, fontFamily: `"${theme.bodyFont}", Inter, sans-serif` }}
      onMouseDown={onInspect ? (event) => event.preventDefault() : undefined}
      onClick={
        onInspect
          ? (event) => {
              event.preventDefault();
              const el = event.target as HTMLElement | null;
              const field = el?.closest?.("[data-edit-field]")?.getAttribute("data-edit-field") || undefined;
              const sectionId = el?.closest?.("[data-preview-id]")?.getAttribute("data-preview-id") || undefined;
              if (sectionId || field) onInspect({ sectionId: sectionId || "brand", field });
            }
          : undefined
      }
    >
      {onInspect && (
        <style>{`
          .lp-inspect [data-preview-id] { position: relative; cursor: pointer; }
          .lp-inspect [data-preview-id]:hover { outline: 2px solid #FFC72C; outline-offset: -2px; }
          .lp-inspect [data-preview-id]:hover::after {
            content: attr(data-preview-label);
            position: absolute;
            z-index: 6;
            top: 8px;
            left: 8px;
            border-radius: 999px;
            background: #0f172a;
            color: #FFC72C;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.04em;
            line-height: 1;
            padding: 6px 8px;
            pointer-events: none;
          }
        `}</style>
      )}
      <header
        className={`${embedded ? "relative" : "sticky"} top-0 z-30 border-b border-[#f0e6c8] bg-[#fffdf8]/95 backdrop-blur`}
        {...(onInspect ? { "data-preview-id": "brand", "data-preview-label": "Marca" } : {})}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#inicio" className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight sm:text-base" style={{ color: theme.primary }} {...mark("brand")}>
              {template.brand}
            </span>
            <span className="block text-[11px] font-medium" style={{ color: theme.accent }} {...mark("area")}>{template.area}</span>
          </a>
          <a href="#contacto" className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold shadow-sm" style={{ background: theme.accent, color: theme.primary }} {...mark("headerCta")}>
            {template.headerCta}
          </a>
        </div>
      </header>
      <main id="inicio">
        {template.sections.map((section) => {
          const node = renderSection(section);
          if (!onInspect || !node) return node;
          return (
            <div key={section.id} data-preview-id={section.id} data-preview-label={PREVIEW_LABEL[section.type]}>
              {node}
            </div>
          );
        })}
      </main>
      <footer className="border-t border-[#f0e6c8] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium" style={{ color: theme.primary }}>{template.brand}</p>
          <p>{template.area}. Esta página no es una oferta de crédito, seguro ni asesoría fiscal.</p>
        </div>
      </footer>
      {!embedded && !done && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#f0e6c8] bg-[#fffdf8]/95 p-3 backdrop-blur md:hidden">
          <a href="#contacto" className="inline-flex min-h-12 w-full items-center justify-center rounded-full text-base font-semibold" style={{ background: theme.accent, color: theme.primary }}>
            {template.sections.find((section) => section.type === "hero" && section.primaryCta)?.type === "hero"
              ? (template.sections.find((section) => section.type === "hero") as { primaryCta: string }).primaryCta
              : template.headerCta}
          </a>
        </div>
      )}
      {!embedded && !done && <div className="h-20 md:hidden" aria-hidden="true" />}
    </div>
  );
}
