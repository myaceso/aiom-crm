"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import FinanzasLanding, { type PreviewPick } from "@/components/landing/FinanzasLanding";
import { resolveInspectTarget } from "@/lib/landing/previewPick";
import {
  LANDING_FONTS,
  blankSection,
  defaultLandingTemplate,
  moveSection,
  type LandingSection,
  type LandingSectionType,
  type LandingTemplate,
} from "@/lib/landing/template";

const ADDABLE: { type: LandingSectionType; label: string }[] = [
  { type: "hero", label: "Hero" },
  { type: "services", label: "Servicios" },
  { type: "benefits", label: "Beneficios" },
  { type: "faq", label: "Preguntas" },
  { type: "text", label: "Texto" },
  { type: "image", label: "Imagen" },
  { type: "cta", label: "Botón" },
];

const TYPE_LABEL: Record<LandingSectionType, string> = {
  hero: "Hero",
  services: "Servicios",
  benefits: "Beneficios",
  faq: "Preguntas",
  contact: "Formulario",
  text: "Texto",
  image: "Imagen",
  cta: "Botón",
};

const inputClass =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-slate-400";

function Field({
  label,
  value,
  onChange,
  multiline = false,
  fieldId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  fieldId?: string;
}) {
  const fieldAttr = fieldId ? { "data-field": fieldId } : {};
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={inputClass} {...fieldAttr} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} {...fieldAttr} />
      )}
    </label>
  );
}

export default function LandingEditor() {
  const [template, setTemplate] = useState<LandingTemplate | null>(null);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<(PreviewPick & { nonce: number }) | null>(null);
  const brandRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fromPreview = useRef(false);

  useEffect(() => {
    if (fromPreview.current) {
      fromPreview.current = false;
      return;
    }
    const id = template?.sections[selected]?.id;
    const root = previewRef.current;
    if (!id || !root || root.getClientRects().length === 0) return;
    const node = root.querySelector(`[data-preview-id="${CSS.escape(id)}"]`);
    if (!(node instanceof HTMLElement)) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const top = node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12;
    root.scrollTo({ top, behavior });
    // Only when the chosen section or the visible tab changes. Typing must not move the preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tab]);

  useEffect(() => {
    if (!pick) return;
    const root = pick.sectionId === "brand" ? brandRef.current : sectionRef.current;
    if (!root) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    root.scrollIntoView({ behavior, block: "center" });
    root.classList.add("lp-editor-flash");
    const timer = window.setTimeout(() => root.classList.remove("lp-editor-flash"), 1400);
    if (pick.field) {
      const selector = `[data-field="${CSS.escape(pick.field)}"]`;
      const node = root.querySelector(selector);
      if (node instanceof HTMLElement) {
        node.focus({ preventScroll: true });
        node.scrollIntoView({ behavior, block: "center" });
      }
    }
    return () => window.clearTimeout(timer);
  }, [pick, tab]);

  function onInspect(raw: PreviewPick) {
    if (!template) return;
    const target = resolveInspectTarget(raw.sectionId, raw.field);
    if (!target) return;
    fromPreview.current = true;
    setTab("edit");
    if (target.panel === "section") {
      const index = template.sections.findIndex((item) => item.id === target.sectionId);
      if (index >= 0) setSelected(index);
    }
    setPick({
      sectionId: target.panel === "brand" ? "brand" : target.sectionId,
      field: target.field,
      nonce: Date.now(),
    });
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/landing/template?editor=1", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 403 ? "Solo un administrador puede editar la landing." : "No se pudo abrir el editor.");
        return;
      }
      const next = (data.draft || data.published || data.defaults) as LandingTemplate;
      setTemplate(next);
    })();
  }, []);

  function patch(partial: Partial<LandingTemplate>) {
    setTemplate((current) => (current ? { ...current, ...partial } : current));
  }

  function patchTheme(partial: Partial<LandingTemplate["theme"]>) {
    setTemplate((current) => (current ? { ...current, theme: { ...current.theme, ...partial } } : current));
  }

  function patchSection(index: number, section: LandingSection) {
    setTemplate((current) => {
      if (!current) return current;
      const sections = current.sections.slice();
      sections[index] = section;
      return { ...current, sections };
    });
  }

  async function send(action: "save" | "publish" | "restore") {
    if (!template && action !== "restore") return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/landing/template", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "restore" ? { action } : { action, template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("No se pudo guardar.");
        return;
      }
      if (data.template) setTemplate(data.template as LandingTemplate);
      setStatus(action === "publish" ? "Publicado. La página pública ya usa estos cambios." : action === "restore" ? "Volviste al diseño original." : "Borrador guardado. Aún no está en la página pública.");
    } catch {
      setError("No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !template) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }
  if (!template) {
    return <p className="text-sm text-slate-500">Cargando editor…</p>;
  }

  const section = template.sections[selected] ?? template.sections[0];
  const once = new Set(template.sections.map((item) => item.type));

  return (
    <div className="space-y-4">
      <style>{`.lp-editor-flash { box-shadow: 0 0 0 3px #FFC72C; border-radius: 12px; }`}</style>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sitios</p>
          <h1 className="text-xl font-semibold text-slate-800">Editor de la landing</h1>
          <p className="text-sm text-slate-500">
            Cambias textos, colores y tipografía de /finanzas. El formulario sigue creando el contacto en el CRM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/finanzas" target="_blank" className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            Ver página
          </Link>
          <button type="button" disabled={busy} onClick={() => void send("save")} className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
            Guardar borrador
          </button>
          <button type="button" disabled={busy} onClick={() => void send("publish")} className="inline-flex min-h-11 items-center rounded-md bg-[#0f172a] px-3 text-sm font-semibold text-[#FFC72C] disabled:opacity-60">
            Publicar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("¿Restaurar el diseño y los textos originales? La página pública volverá a ese diseño.")) {
                setTemplate(defaultLandingTemplate());
                void send("restore");
              }
            }}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-slate-500"
          >
            Restaurar original
          </button>
        </div>
      </div>
      {status && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <button type="button" onClick={() => setTab("edit")} className={`min-h-11 rounded-md text-sm font-semibold ${tab === "edit" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>Editar</button>
        <button type="button" onClick={() => setTab("preview")} className={`min-h-11 rounded-md text-sm font-semibold ${tab === "preview" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>Vista previa</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={`space-y-4 ${tab === "preview" ? "hidden md:block" : ""}`}>
          <section ref={brandRef} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Marca, colores y tipografía</h2>
            <Field fieldId="brand" label="Nombre" value={template.brand} onChange={(brand) => patch({ brand })} />
            <Field fieldId="area" label="Zona" value={template.area} onChange={(area) => patch({ area })} />
            <Field fieldId="headerCta" label="Botón del encabezado" value={template.headerCta} onChange={(headerCta) => patch({ headerCta })} />
            <div className="grid grid-cols-3 gap-2">
              {([
                ["accent", "Acento"],
                ["primary", "Principal"],
                ["background", "Fondo"],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-semibold text-slate-600">
                  {label}
                  <input type="color" value={template.theme[key]} onChange={(e) => patchTheme({ [key]: e.target.value })} className="mt-1 h-11 w-full cursor-pointer rounded-md border border-slate-200 bg-white" />
                </label>
              ))}
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Fuente de títulos
              <select value={template.theme.headingFont} onChange={(e) => patchTheme({ headingFont: e.target.value as LandingTemplate["theme"]["headingFont"] })} className={inputClass}>
                {LANDING_FONTS.map((font) => <option key={font}>{font}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Fuente del texto
              <select value={template.theme.bodyFont} onChange={(e) => patchTheme({ bodyFont: e.target.value as LandingTemplate["theme"]["bodyFont"] })} className={inputClass}>
                {LANDING_FONTS.map((font) => <option key={font}>{font}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Tamaño de títulos
                <select value={template.theme.headingSize} onChange={(e) => patchTheme({ headingSize: e.target.value as LandingTemplate["theme"]["headingSize"] })} className={inputClass}>
                  <option value="sm">Pequeño</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                  <option value="xl">Extra grande</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Tamaño del texto
                <select value={template.theme.bodySize} onChange={(e) => patchTheme({ bodySize: e.target.value as LandingTemplate["theme"]["bodySize"] })} className={inputClass}>
                  <option value="sm">Pequeño</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                  <option value="xl">Extra grande</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Grosor de títulos
              <select value={template.theme.headingWeight} onChange={(e) => patchTheme({ headingWeight: e.target.value as LandingTemplate["theme"]["headingWeight"] })} className={inputClass}>
                <option value="600">Seminegrita</option>
                <option value="700">Negrita</option>
                <option value="800">Extra negrita</option>
              </select>
            </label>
            <Field fieldId="phoneDisplay" label="Teléfono visible" value={template.phoneDisplay} onChange={(phoneDisplay) => patch({ phoneDisplay })} />
            <Field fieldId="phoneE164" label="Teléfono (solo dígitos, vacío = sin enlace)" value={template.phoneE164} onChange={(phoneE164) => patch({ phoneE164 })} />
            <Field fieldId="whatsappDisplay" label="WhatsApp visible" value={template.whatsappDisplay} onChange={(whatsappDisplay) => patch({ whatsappDisplay })} />
            <Field fieldId="whatsappE164" label="WhatsApp (solo dígitos, vacío = sin enlace)" value={template.whatsappE164} onChange={(whatsappE164) => patch({ whatsappE164 })} />
            <p className="text-xs leading-5 text-slate-500">Las imágenes se pegan como URL https. No subas un archivo aquí: el almacén de medios del CRM es el de Marketing.</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Secciones</h2>
            <ul className="mt-3 space-y-2">
              {template.sections.map((item, index) => (
                <li key={`${item.type}-${item.id}`} className={`rounded-lg border p-2 ${index === selected ? "border-slate-900" : "border-slate-200"}`}>
                  <button type="button" onClick={() => setSelected(index)} className="w-full text-left text-sm font-semibold text-slate-800">
                    {TYPE_LABEL[item.type]}
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold" onClick={() => { patch({ sections: moveSection(template.sections, index, -1) }); setSelected(Math.max(0, index - 1)); }}>Subir</button>
                    <button type="button" className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold" onClick={() => { patch({ sections: moveSection(template.sections, index, 1) }); setSelected(Math.min(template.sections.length - 1, index + 1)); }}>Bajar</button>
                    {item.type !== "contact" && (
                      <button type="button" className="min-h-10 rounded-md px-3 text-xs font-semibold text-red-600" onClick={() => {
                        const sections = template.sections.filter((_, itemIndex) => itemIndex !== index);
                        patch({ sections });
                        setSelected(Math.max(0, index - 1));
                      }}>Quitar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {ADDABLE.filter((item) => item.type === "text" || item.type === "image" || item.type === "cta" || !once.has(item.type)).map((item) => (
                <button key={item.type} type="button" className="min-h-10 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700" onClick={() => {
                  const sections = [...template.sections, blankSection(item.type)];
                  patch({ sections });
                  setSelected(sections.length - 1);
                }}>
                  + {item.label}
                </button>
              ))}
            </div>
          </section>

          {section && (
            <section ref={sectionRef} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">Editar {TYPE_LABEL[section.type]}</h2>
              <SectionFields section={section} onChange={(next) => patchSection(selected, next)} />
              {section.type === "contact" && (
                <p className="text-xs leading-5 text-slate-500">El formulario no se puede quitar. Nombre, teléfono, correo, servicio, mensaje, consentimiento y el campo oculto contra spam siguen igual, y cada envío crea un lead.</p>
              )}
            </section>
          )}
        </div>

        <div className={`${tab === "edit" ? "hidden md:block" : ""} overflow-hidden rounded-xl border border-slate-200 bg-slate-100`}>
          <p className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Vista previa en vivo · haz clic en una sección para editarla
          </p>
          <div ref={previewRef} className="max-h-[80vh] overflow-auto">
            <FinanzasLanding template={template} embedded onInspect={onInspect} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionFields({ section, onChange }: { section: LandingSection; onChange: (section: LandingSection) => void }) {
  if (section.type === "hero") {
    return (
      <>
        <Field fieldId="eyebrow" label="Antetítulo" value={section.eyebrow} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
        <Field fieldId="title" label="Titular" value={section.title} onChange={(title) => onChange({ ...section, title })} />
        <Field fieldId="highlight" label="Palabra resaltada (opcional, debe estar en el titular)" value={section.highlight} onChange={(highlight) => onChange({ ...section, highlight })} />
        <Field fieldId="subtitle" label="Texto" value={section.subtitle} onChange={(subtitle) => onChange({ ...section, subtitle })} multiline />
        <Field fieldId="primaryCta" label="Botón principal" value={section.primaryCta} onChange={(primaryCta) => onChange({ ...section, primaryCta })} />
        <Field fieldId="secondaryCta" label="Botón secundario" value={section.secondaryCta} onChange={(secondaryCta) => onChange({ ...section, secondaryCta })} />
      </>
    );
  }
  if (section.type === "services") {
    return (
      <>
        <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        <Field fieldId="intro" label="Introducción" value={section.intro} onChange={(intro) => onChange({ ...section, intro })} multiline />
        {section.items.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <Field fieldId={`svc:${item.id}:title`} label="Servicio" value={item.title} onChange={(title) => {
              const items = section.items.slice();
              items[index] = { ...item, title };
              onChange({ ...section, items });
            }} />
            <Field fieldId={`svc:${item.id}:summary`} label="Descripción" value={item.summary} onChange={(summary) => {
              const items = section.items.slice();
              items[index] = { ...item, summary };
              onChange({ ...section, items });
            }} multiline />
            <button type="button" className="text-xs font-semibold text-red-600" onClick={() => onChange({ ...section, items: section.items.filter((_, itemIndex) => itemIndex !== index) })}>Quitar servicio</button>
          </div>
        ))}
        <button type="button" className="min-h-10 text-sm font-semibold text-slate-700" onClick={() => onChange({ ...section, items: [...section.items, { id: `svc-${Date.now().toString(36)}`, title: "Nuevo servicio", summary: "" }] })}>+ Servicio</button>
      </>
    );
  }
  if (section.type === "benefits") {
    return (
      <>
        <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        {section.items.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <Field fieldId={`ben:${item.id}:title`} label="Beneficio" value={item.title} onChange={(title) => {
              const items = section.items.slice();
              items[index] = { ...item, title };
              onChange({ ...section, items });
            }} />
            <Field fieldId={`ben:${item.id}:body`} label="Texto" value={item.body} onChange={(body) => {
              const items = section.items.slice();
              items[index] = { ...item, body };
              onChange({ ...section, items });
            }} multiline />
            <button type="button" className="text-xs font-semibold text-red-600" onClick={() => onChange({ ...section, items: section.items.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button>
          </div>
        ))}
        <button type="button" className="min-h-10 text-sm font-semibold text-slate-700" onClick={() => onChange({ ...section, items: [...section.items, { id: `ben-${Date.now().toString(36)}`, title: "Nuevo beneficio", body: "" }] })}>+ Beneficio</button>
      </>
    );
  }
  if (section.type === "faq") {
    return (
      <>
        <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        {section.items.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
            <Field fieldId={`faq:${item.id}:q`} label="Pregunta" value={item.q} onChange={(q) => {
              const items = section.items.slice();
              items[index] = { ...item, q };
              onChange({ ...section, items });
            }} />
            <Field fieldId={`faq:${item.id}:a`} label="Respuesta" value={item.a} onChange={(a) => {
              const items = section.items.slice();
              items[index] = { ...item, a };
              onChange({ ...section, items });
            }} multiline />
            <button type="button" className="text-xs font-semibold text-red-600" onClick={() => onChange({ ...section, items: section.items.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button>
          </div>
        ))}
        <button type="button" className="min-h-10 text-sm font-semibold text-slate-700" onClick={() => onChange({ ...section, items: [...section.items, { id: `faq-${Date.now().toString(36)}`, q: "¿Nueva pregunta?", a: "" }] })}>+ Pregunta</button>
      </>
    );
  }
  if (section.type === "contact") {
    return (
      <>
        <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        <Field fieldId="intro" label="Texto" value={section.intro} onChange={(intro) => onChange({ ...section, intro })} multiline />
      </>
    );
  }
  if (section.type === "text") {
    return (
      <>
        <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
        <Field fieldId="body" label="Texto" value={section.body} onChange={(body) => onChange({ ...section, body })} multiline />
      </>
    );
  }
  if (section.type === "image") {
    return (
      <>
        <Field fieldId="url" label="URL https de la imagen" value={section.url} onChange={(url) => onChange({ ...section, url })} />
        <Field fieldId="alt" label="Texto alternativo" value={section.alt} onChange={(alt) => onChange({ ...section, alt })} />
        <Field fieldId="caption" label="Pie de foto" value={section.caption} onChange={(caption) => onChange({ ...section, caption })} />
      </>
    );
  }
  return (
    <>
      <Field fieldId="heading" label="Título" value={section.heading} onChange={(heading) => onChange({ ...section, heading })} />
      <Field fieldId="body" label="Texto" value={section.body} onChange={(body) => onChange({ ...section, body })} multiline />
      <Field fieldId="label" label="Texto del botón" value={section.label} onChange={(label) => onChange({ ...section, label })} />
      <Field fieldId="href" label="Enlace (#contacto, https://…)" value={section.href} onChange={(href) => onChange({ ...section, href })} />
    </>
  );
}
