"use client";

import { FormEvent, useState } from "react";
import {
  BadgeCheck,
  HeartHandshake,
  Landmark,
  PiggyBank,
  Receipt,
  Shield,
  type LucideIcon,
} from "lucide-react";
import {
  LANDING_AREA,
  LANDING_BENEFITS,
  LANDING_BRAND,
  LANDING_CONTACT,
  LANDING_FAQ,
  LANDING_SERVICES,
  phoneHref,
  whatsappHref,
} from "@/lib/landing/config";

const ICONS: Record<(typeof LANDING_SERVICES)[number]["id"], LucideIcon> = {
  "seguros-de-vida": Shield,
  prestamos: Landmark,
  credito: BadgeCheck,
  impuestos: Receipt,
  ahorro: PiggyBank,
};

const ERRORS: Record<string, string> = {
  invalid_name: "Escribe tu nombre completo.",
  invalid_phone: "Escribe un teléfono válido, con código de área.",
  invalid_email: "Escribe un correo electrónico válido.",
  invalid_service: "Elige el servicio que te interesa.",
  invalid_message: "El mensaje es demasiado largo.",
  consent_required: "Necesitamos tu permiso para contactarte.",
  too_many: "Enviaste varias solicitudes. Espera unos minutos e inténtalo de nuevo.",
  unavailable: "Ahora no pudimos guardar tu solicitud. Inténtalo de nuevo en un momento.",
};

const FACTS = [
  { value: String(LANDING_SERVICES.length), label: "servicios en un solo lugar" },
  { value: "Español", label: "te lo explicamos con calma" },
  { value: "Atlanta", label: "personas y negocios de Georgia" },
  { value: "Sin costo", label: "enviar este formulario" },
] as const;

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
}: {
  label: string;
  display: string;
  href: string | null;
}) {
  const className =
    "inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-base font-medium text-white";
  const inner = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FFC72C]">
        {label}
      </span>
      <span className="truncate">{display}</span>
    </>
  );
  if (!href) {
    return (
      <span className={`${className} border-dashed border-[#FFC72C]/45 bg-white/5`}>{inner}</span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={`${className} border-[#FFC72C]/70 bg-white/10 hover:bg-white/15`}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

const fieldClass =
  "mt-2 w-full rounded-2xl border border-white/15 bg-[#0c1220] px-4 py-3.5 text-lg text-white outline-none placeholder:text-slate-500 focus:border-[#FFC72C] focus:ring-2 focus:ring-[#FFC72C]/40";

export default function FinanzasLanding() {
  const tel = phoneHref();
  const wa = whatsappHref();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    if (!service) {
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
          service,
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

  return (
    <div data-landing="finanzas" className="relative min-h-screen overflow-x-clip bg-[#07090f] text-[#e7ebf3]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] overflow-hidden">
        <div className="absolute -left-24 top-10 h-[28rem] w-[28rem] rounded-full bg-[#FFC72C]/20 blur-[110px]" />
        <div className="absolute right-[-6rem] top-40 h-[24rem] w-[24rem] rounded-full bg-[#FFC72C]/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a href="#inicio" className="min-w-0">
            <span className="fin-display block truncate text-lg font-extrabold leading-tight tracking-tight text-white sm:text-xl">
              {LANDING_BRAND}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-[#FFC72C]">{LANDING_AREA}</span>
          </a>
          <a
            href="#contacto"
            className="fin-cta inline-flex shrink-0 items-center rounded-full bg-[#FFC72C] px-5 text-base font-bold text-[#111318] sm:px-6 sm:text-lg"
          >
            Contactar
          </a>
        </div>
      </header>

      <main id="inicio" className="relative">
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p className="fin-rise text-sm font-semibold uppercase tracking-[0.22em] text-[#FFC72C] sm:text-base">
            {LANDING_AREA}
          </p>
          <h1 className="fin-hero-title fin-rise fin-d1 mt-4 max-w-5xl text-white">
            Ordena tu dinero con alguien que te <span className="fin-gold">habla claro</span>
          </h1>
          <p className="fin-lead fin-rise fin-d2 mt-6 max-w-2xl text-slate-300">
            Seguros de vida, préstamos, crédito, impuestos y ahorro para personas y negocios. En
            español, sin presión y sin prometer una aprobación.
          </p>
          <div className="fin-rise fin-d3 mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contacto"
              className="fin-cta inline-flex items-center justify-center rounded-full bg-[#FFC72C] px-8 text-lg font-bold text-[#111318]"
            >
              Quiero que me contacten
            </a>
            <a
              href="#servicios"
              className="inline-flex min-h-[3.6rem] items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-lg font-semibold text-white hover:border-[#FFC72C]/50"
            >
              Ver servicios
            </a>
          </div>
          <div className="fin-rise fin-d4 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ContactChip label="Teléfono" display={LANDING_CONTACT.phoneDisplay} href={tel} />
            <ContactChip label="WhatsApp" display={LANDING_CONTACT.whatsappDisplay} href={wa} />
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
            {FACTS.map((fact) => (
              <div key={fact.value} className="px-4 py-6 sm:px-6 sm:py-8">
                <p className="fin-display text-3xl font-extrabold tracking-tight text-[#FFC72C] sm:text-4xl">
                  {fact.value}
                </p>
                <p className="mt-1 text-base leading-snug text-slate-300 sm:text-lg">{fact.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="servicios" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="fin-h2 max-w-3xl text-white">Cómo podemos ayudarte</h2>
          <p className="fin-lead mt-4 max-w-2xl text-slate-300">
            Elige el tema que te urge hoy. En la conversación vemos si encaja y qué sigue.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_SERVICES.map((serviceItem, index) => {
              const Icon = ICONS[serviceItem.id];
              return (
                <article
                  key={serviceItem.id}
                  className="fin-card fin-rise rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
                  style={{ animationDelay: `${0.08 * index}s` }}
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFC72C] text-[#111318] shadow-[0_8px_24px_rgba(255,199,44,0.28)]">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h3 className="fin-display mt-5 text-2xl font-extrabold tracking-tight text-white">
                    {serviceItem.label}
                  </h3>
                  <p className="mt-3 text-lg leading-relaxed text-slate-300">{serviceItem.summary}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0c1018]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="fin-h2 text-white">Por qué hablar con nosotros</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {LANDING_BENEFITS.map((item) => (
                <article
                  key={item.title}
                  className="fin-card rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <HeartHandshake className="h-7 w-7 text-[#FFC72C]" aria-hidden="true" />
                  <h3 className="fin-display mt-4 text-2xl font-extrabold tracking-tight text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-lg leading-relaxed text-slate-300">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="fin-h2 text-white">Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            {LANDING_FAQ.map((item) => (
              <details key={item.q} className="group px-5 sm:px-7">
                <summary className="cursor-pointer list-none py-5 text-lg font-semibold text-white sm:text-xl [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="fin-display text-2xl text-[#FFC72C] group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </span>
                </summary>
                <p className="pb-5 text-lg leading-relaxed text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contacto" className="scroll-mt-24 border-t border-white/10 bg-[#0c1018]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="fin-h2 text-white">Cuéntanos qué necesitas</h2>
              <p className="fin-lead mt-4 text-slate-300">
                Déjanos tu nombre, teléfono y el servicio. Te contactamos para escuchar tu caso. No
                hace falta que tengas todos los papeles a la mano.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <ContactChip label="Teléfono" display={LANDING_CONTACT.phoneDisplay} href={tel} />
                <ContactChip label="WhatsApp" display={LANDING_CONTACT.whatsappDisplay} href={wa} />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#FFC72C]/30 bg-[#101624] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:p-8">
              {done ? (
                <div role="status" className="py-10 text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FFC72C]">
                    Listo
                  </p>
                  <h3 className="fin-display mt-3 text-4xl font-extrabold tracking-tight text-white">
                    Recibimos tu solicitud
                  </h3>
                  <p className="fin-lead mx-auto mt-4 max-w-sm text-slate-300">
                    Te contactaremos pronto al teléfono o al correo que nos dejaste.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="relative space-y-5" noValidate>
                  <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                    <label>
                      Sitio web
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        name="company_website"
                      />
                    </label>
                  </div>
                  <label className="block text-base font-semibold text-white">
                    Nombre
                    <input
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={fieldClass}
                      placeholder="Tu nombre"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-base font-semibold text-white">
                      Teléfono
                      <input
                        required
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={fieldClass}
                        placeholder="Tu número con código de área"
                      />
                    </label>
                    <label className="block text-base font-semibold text-white">
                      Correo
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldClass}
                        placeholder="tu@correo.com"
                      />
                    </label>
                  </div>
                  <label className="block text-base font-semibold text-white">
                    Servicio de interés
                    <select
                      required
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Elige un servicio</option>
                      {LANDING_SERVICES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-base font-semibold text-white">
                    Mensaje
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      className={fieldClass}
                      placeholder="Cuéntanos, en pocas líneas, qué estás buscando."
                    />
                  </label>
                  <label className="flex items-start gap-3 text-base leading-7 text-slate-300">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1.5 h-5 w-5 shrink-0 accent-[#FFC72C]"
                    />
                    <span>
                      Acepto que me contacten sobre el servicio que elegí. Mis datos se usan solo
                      para esta solicitud.
                    </span>
                  </label>
                  {error && (
                    <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-base text-red-200">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="fin-cta inline-flex w-full items-center justify-center rounded-full bg-[#FFC72C] px-8 text-lg font-bold text-[#111318] disabled:opacity-60"
                  >
                    {busy ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07090f]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-base text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="fin-display font-bold text-white">{LANDING_BRAND}</p>
          <p>{LANDING_AREA}. Esta página no es una oferta de crédito, seguro ni asesoría fiscal.</p>
        </div>
      </footer>

      {!done && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#07090f]/92 p-3 backdrop-blur-xl md:hidden">
          <a
            href="#contacto"
            className="fin-cta inline-flex w-full items-center justify-center rounded-full bg-[#FFC72C] text-lg font-bold text-[#111318]"
          >
            Quiero que me contacten
          </a>
        </div>
      )}
      {!done && <div className="h-24 md:hidden" aria-hidden="true" />}
    </div>
  );
}
