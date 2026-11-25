import type { ReactNode } from "react";
import { Bricolage_Grotesque, Outfit } from "next/font/google";
import "./landing.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-landing-body",
  display: "swap",
});

export default function FinanzasLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="es" className={`${display.variable} ${body.variable} finanzas-root`}>
      {children}
    </div>
  );
}
