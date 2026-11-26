import type { Metadata } from "next";
import FinanzasLanding from "@/components/landing/FinanzasLanding";
import { defaultLandingTemplate, sanitizeLandingTemplate } from "@/lib/landing/template";
import { getPublishedLanding } from "@/lib/landing/templateStore";

export const dynamic = "force-dynamic";

async function loadTemplate() {
  try {
    const published = await getPublishedLanding();
    return published ? sanitizeLandingTemplate(published) : defaultLandingTemplate();
  } catch {
    return defaultLandingTemplate();
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const template = await loadTemplate();
  return {
    title: `${template.brand} | ${template.area}`,
    description:
      "Seguros de vida, préstamos, crédito, impuestos y ahorro en español para personas y negocios en el área de Atlanta, Georgia.",
    openGraph: {
      title: template.brand,
      description:
        "Servicios financieros en español para personas y negocios en el área de Atlanta, Georgia.",
      locale: "es_US",
      type: "website",
    },
  };
}

export default async function FinanzasPage() {
  const template = await loadTemplate();
  return (
    <div lang="es">
      <FinanzasLanding template={template} />
    </div>
  );
}
