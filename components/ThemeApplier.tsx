"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export default function ThemeApplier() {
  const primaryColor = useStore((s) => s.settings.primaryColor);
  useEffect(() => {
    const color = primaryColor || "#6366f1";
    document.documentElement.style.setProperty("--brand", color);
    // Derive a slightly darker hover when using custom primary
    document.documentElement.style.setProperty(
      "--brand-hover",
      color === "#6366f1" ? "#4f46e5" : color
    );
  }, [primaryColor]);
  return null;
}
