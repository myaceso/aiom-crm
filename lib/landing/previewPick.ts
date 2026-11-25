const BRAND_FIELDS = new Set([
  "brand",
  "area",
  "headerCta",
  "phoneDisplay",
  "phoneE164",
  "whatsappDisplay",
  "whatsappE164",
]);

export type InspectTarget = {
  panel: "brand" | "section";
  sectionId: string;
  field?: string;
};

/** Maps a preview click to the editor panel that owns that text. */
export function resolveInspectTarget(sectionId: string | null, field?: string | null): InspectTarget | null {
  const cleanField = field?.trim() || undefined;
  if (cleanField && BRAND_FIELDS.has(cleanField)) {
    return { panel: "brand", sectionId: "brand", field: cleanField };
  }
  if (sectionId === "brand") {
    return { panel: "brand", sectionId: "brand", field: cleanField };
  }
  if (!sectionId) return null;
  return { panel: "section", sectionId, field: cleanField };
}
