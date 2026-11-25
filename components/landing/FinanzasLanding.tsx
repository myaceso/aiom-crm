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
    "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-[#0f172a]";
  const inner = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a6a12]">
        {label}
      </span>
      <span className="truncate">{display}</span>
    </>
  );
  if (!href) {
    return <span className={`${className} border-dashed border-[#e4d7a8] bg-[#fffaf0]`}>{inner}</span>;
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={`${className} border-[#FFC72C] bg-white hover:bg-[#fff6d8]`}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-[#0f172a] outline-none ring-[#FFC72C] placeholder:text-slate-400 focus:border-[#FFC72C] focus:ring-2";

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
    <div data-landing="finanzas" className="min-h-screen bg-[#fffdf8] text-[#334155]">
      <header className="sticky top-0 z-30 border-b border-[#f0e6c8] bg-[#fffdf8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#inicio" className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-[#0f172a] sm:text-base">
              {LANDING_BRAND}
            </span>
            <span className="block text-[11px] font-medium text-[#8a6a12]">{LANDING_AREA}</span>
          </a>
          <a
            href="#contacto"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[#FFC72C] px-4 text-sm font-semibold text-[#0f172a] shadow-sm"
          >
            Contactar
          </a>
        </div>
      </header>

      <main id="inicio">
        <section className="relative overflow-hidden bg-[#0f172a] text-white">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#FFC72C]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-[#FFC72C]" />
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FFC72C]">
              {LANDING_AREA}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
              Ordena tu dinero con alguien que te habla claro
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Seguros de vida, préstamos, crédito, impuestos y ahorro para personas y
              negocios. En español, sin presión y sin prometer una aprobación.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contacto"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FFC72C] px-6 text-base font-semibold text-[#0f172a]"
              >
                Quiero que me contacten
              </a>
              <a
                href="#servicios"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 text-base font-semibold text-white"
              >
                Ver servicios
              </a>
            </div>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <ContactChip label="Teléfono" display={LANDING_CONTACT.phoneDisplay} href={tel} />
              <ContactChip label="WhatsApp" display={LANDING_CONTACT.whatsappDisplay} href={wa} />
            </div>
          </div>
        </section>

        <section id="servicios" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
            Cómo podemos ayudarte
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Elige el tema que te urge hoy. En la conversación vemos si encaja y qué sigue.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_SERVICES.map((serviceItem) => {
              const Icon = ICONS[serviceItem.id];
              return (
                <article
                  key={serviceItem.id}
                  className="rounded-2xl border border-[#f0e6c8] bg-white p-5 shadow-card"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4cc] text-[#0f172a]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-[#0f172a]">{serviceItem.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{serviceItem.summary}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-[#0f172a] text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Por qué hablar con nosotros</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {LANDING_BENEFITS.map((item) => (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <HeartHandshake className="h-5 w-5 text-[#FFC72C]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
            Preguntas frecuentes
          </h2>
          <div className="mt-6 divide-y divide-[#f0e6c8] overflow-hidden rounded-2xl border border-[#f0e6c8] bg-white">
            {LANDING_FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-1">
                <summary className="cursor-pointer list-none py-4 text-base font-semibold text-[#0f172a] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-[#8a6a12] group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </span>
                </summary>
                <p className="pb-4 text-sm leading-6 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contacto" className="scroll-mt-20 bg-[#fff6d8]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
                Cuéntanos qué necesitas
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                Déjanos tu nombre, teléfono y el servicio. Te contactamos para escuchar tu caso.
                No hace falta que tengas todos los papeles a la mano.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <ContactChip label="Teléfono" display={LANDING_CONTACT.phoneDisplay} href={tel} />
                <ContactChip label="WhatsApp" display={LANDING_CONTACT.whatsappDisplay} href={wa} />
              </div>
            </div>

            <div className="rounded-3xl border border-[#f0e6c8] bg-white p-5 shadow-card sm:p-7">
              {done ? (
                <div role="status" className="py-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6a12]">
                    Listo
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#0f172a]">
                    Recibimos tu solicitud
                  </h3>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
                    Te contactaremos pronto al teléfono o al correo que nos dejaste.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="relative space-y-4" noValidate>
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
                  <label className="block text-sm font-semibold text-[#0f172a]">
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
                    <label className="block text-sm font-semibold text-[#0f172a]">
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
                    <label className="block text-sm font-semibold text-[#0f172a]">
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
                  <label className="block text-sm font-semibold text-[#0f172a]">
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
                  <label className="block text-sm font-semibold text-[#0f172a]">
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
                  <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 accent-[#0f172a]"
                    />
                    <span>
                      Acepto que me contacten sobre el servicio que elegí. Mis datos se usan solo
                      para esta solicitud.
                    </span>
                  </label>
                  {error && (
                    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FFC72C] px-6 text-base font-semibold text-[#0f172a] disabled:opacity-60"
                  >
                    {busy ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#f0e6c8] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-[#0f172a]">{LANDING_BRAND}</p>
          <p>{LANDING_AREA}. Esta página no es una oferta de crédito, seguro ni asesoría fiscal.</p>
        </div>
      </footer>

      {!done && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#f0e6c8] bg-[#fffdf8]/95 p-3 backdrop-blur md:hidden">
          <a
            href="#contacto"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FFC72C] text-base font-semibold text-[#0f172a]"
          >
            Quiero que me contacten
          </a>
        </div>
      )}
      {!done && <div className="h-20 md:hidden" aria-hidden="true" />}
    </div>
  );
}
