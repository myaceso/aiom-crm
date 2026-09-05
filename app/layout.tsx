import type { Metadata } from "next";
import "./globals.css";
import BootGate from "@/components/BootGate";
import ToastHost from "@/components/Toast";
import ThemeApplier from "@/components/ThemeApplier";

export const metadata: Metadata = {
  title: "All In One Marketing",
  description: "All In One Marketing CRM demo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <BootGate>
          <ThemeApplier />
          {children}
          <ToastHost />
        </BootGate>
      </body>
    </html>
  );
}
