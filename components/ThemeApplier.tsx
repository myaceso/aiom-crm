"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export default function ThemeApplier() {
  const primaryColor = useStore((s) => s.settings.primaryColor);
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", primaryColor || "#38a0db");
  }, [primaryColor]);
  return null;
}
