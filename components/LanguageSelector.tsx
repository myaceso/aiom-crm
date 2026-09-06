"use client";

import { langLabels, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { useStore } from "@/store/useStore";
import { ChevronDown } from "lucide-react";

export default function LanguageSelector() {
  const language = useStore((s) => s.settings.language);
  const setLanguage = useStore((s) => s.setLanguage);

  return (
    <div className="flex items-center gap-2 text-sm text-[#607179]">
      <span className="hidden sm:inline">{t(language, "platformLanguage")}</span>
      <div className="relative">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className="appearance-none rounded-md border border-[#d1d5db] bg-white py-1.5 pl-3 pr-8 text-sm text-[#374151] outline-none focus:ring-2 focus:ring-[#6366f1]/40"
          aria-label="Platform language"
        >
          {(Object.keys(langLabels) as Lang[]).map((code) => (
            <option key={code} value={code}>
              {langLabels[code]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}
