import assert from "node:assert/strict";
import test from "node:test";
import {
  blankSection,
  defaultLandingTemplate,
  moveSection,
  safeHref,
  sanitizeLandingTemplate,
  serviceChoices,
} from "./template.ts";

test("the default template matches the live Finanzas page", () => {
  const template = defaultLandingTemplate();
  assert.equal(template.path, "/finanzas");
  assert.equal(template.theme.accent, "#FFC72C");
  assert.equal(template.theme.headingFont, "Inter");
  assert.equal(template.theme.headingSize, "md");
  assert.equal(template.phoneDisplay, "[PLACEHOLDER: teléfono]");
  const services = template.sections.find((section) => section.type === "services");
  assert.equal(services?.type, "services");
  if (services?.type === "services") {
    assert.deepEqual(
      services.items.map((item) => item.title),
      ["Seguros de vida", "Préstamos", "Crédito", "Impuestos", "Ahorro y planificación"]
    );
  }
  assert.equal(template.sections.some((section) => section.type === "contact"), true);
});

test("sanitize keeps the contact form, drops unsafe links, and falls back on bad colors and fonts", () => {
  const clean = sanitizeLandingTemplate({
    brand: "Mi marca",
    theme: { accent: "red", headingFont: "Comic Sans", headingSize: "xl", headingWeight: "800" },
    sections: [
      { type: "cta", heading: "Hola", label: "Ir", href: "javascript:alert(1)" },
      { type: "image", url: "http://inseguro.example/a.jpg", alt: "foto" },
      { type: "text", heading: "<b>Hola</b>", body: "Texto" },
    ],
  });
  assert.equal(clean.brand, "Mi marca");
  assert.equal(clean.theme.accent, "#FFC72C");
  assert.equal(clean.theme.headingFont, "Inter");
  assert.equal(clean.theme.headingSize, "xl");
  assert.equal(clean.theme.headingWeight, "800");
  assert.equal(clean.sections.some((section) => section.type === "contact"), true);
  const cta = clean.sections.find((section) => section.type === "cta");
  assert.equal(cta?.type, "cta");
  if (cta?.type === "cta") assert.equal(cta.href, "#contacto");
  const image = clean.sections.find((section) => section.type === "image");
  if (image?.type === "image") assert.equal(image.url, "");
  const text = clean.sections.find((section) => section.type === "text");
  if (text?.type === "text") assert.equal(text.heading, "bHola/b");
  assert.equal(clean.sections.filter((section) => section.type === "contact").length, 1);
});

test("https links and anchors survive, and sections can move without losing the form", () => {
  assert.equal(safeHref("https://enone.app/finanzas"), "https://enone.app/finanzas");
  assert.equal(safeHref("#contacto"), "#contacto");
  const template = defaultLandingTemplate();
  const moved = moveSection(template.sections, 0, 1);
  assert.equal(moved[0].type, "services");
  assert.equal(moved[1].type, "hero");
  assert.equal(serviceChoices({ ...template, sections: moved }).length, 5);
  const extra = blankSection("text");
  assert.equal(extra.type, "text");
});

test("a published custom service id is a valid form choice", () => {
  const template = sanitizeLandingTemplate({
    sections: [
      {
        type: "services",
        heading: "Servicios",
        items: [{ id: "hipotecas", title: "Orientación hipotecaria", summary: "Sin prometer aprobación." }],
      },
    ],
  });
  assert.deepEqual(serviceChoices(template), [{ id: "hipotecas", title: "Orientación hipotecaria" }]);
});
