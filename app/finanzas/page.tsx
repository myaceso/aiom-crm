import type { Metadata } from "next";
import FinanzasLanding from "@/components/landing/FinanzasLanding";
import { LANDING_AREA, LANDING_BRAND } from "@/lib/landing/config";

export const metadata: Metadata = {
  title: `${LANDING_BRAND} | ${LANDING_AREA}`,
  description:
    "Seguros de vida, préstamos, crédito, impuestos y ahorro en español para personas y negocios en el área de Atlanta, Georgia.",
  openGraph: {
    title: LANDING_BRAND,
    description:
      "Servicios financieros en español para personas y negocios en el área de Atlanta, Georgia.",
    locale: "es_US",
    type: "website",
  },
};

export default function FinanzasPage() {
  return (
    <div lang="es">
      <FinanzasLanding />
    </div>
  );
}
