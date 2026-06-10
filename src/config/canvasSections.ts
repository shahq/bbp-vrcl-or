export const ACT1_CARD_CHARACTER_LIMIT = 105;

export const ACT1_SECTION_IDS = [
  "place",
  "role",
  "point_a",
  "point_b",
  "change",
] as const;

export const CANVAS_SECTION_IDS = [
  ...ACT1_SECTION_IDS,
  "story",
] as const;

export const LEGACY_SECTION_IDS = ["challenge"] as const;

export type Act1SectionId = typeof ACT1_SECTION_IDS[number];
export type CanvasSectionId = typeof CANVAS_SECTION_IDS[number];
export type LegacySectionId = typeof LEGACY_SECTION_IDS[number];

export const SECTION_LABELS: Record<CanvasSectionId, string> = {
  place: "Setting",
  role: "Role",
  point_a: "Challenge",
  point_b: "Desired end state",
  change: "How do we get there?",
  story: "Story Foundation",
};

export const SECTION_EXPORT_TITLES: Record<CanvasSectionId, string> = {
  place: "Setting",
  role: "Role",
  point_a: "Challenge",
  point_b: "Desired end state",
  change: "How do we get there?",
  story: "Story Foundation",
};

export const SECTION_CARD_COLORS: Record<CanvasSectionId, string> = {
  place: "bg-[#e8f5e9]",
  role: "bg-[#ffebee]",
  point_a: "bg-[#f3e5f5]",
  point_b: "bg-[#e0f7fa]",
  change: "bg-white border-2 border-gray-500",
  story: "bg-[#fff9c4]",
};

export const CANVAS_COLUMNS: Array<{ id: CanvasSectionId; title: string; color: string }> =
  CANVAS_SECTION_IDS.map((id) => ({
    id,
    title: SECTION_LABELS[id],
    color: SECTION_CARD_COLORS[id],
  }));

const ACT1_SECTION_SET = new Set<string>(ACT1_SECTION_IDS);
const CANVAS_SECTION_SET = new Set<string>(CANVAS_SECTION_IDS);
const LEGACY_SECTION_SET = new Set<string>(LEGACY_SECTION_IDS);

export function isAct1SectionId(section: string | undefined): section is Act1SectionId {
  return Boolean(section && ACT1_SECTION_SET.has(section));
}

export function isCanvasSectionId(section: string | undefined): section is CanvasSectionId {
  return Boolean(section && CANVAS_SECTION_SET.has(section));
}

export function isLegacySectionId(section: string | undefined): section is LegacySectionId {
  return Boolean(section && LEGACY_SECTION_SET.has(section));
}

export function getSectionLabel(section: string | undefined): string {
  if (isCanvasSectionId(section)) return SECTION_LABELS[section];
  if (isLegacySectionId(section)) return "Challenge";
  if (!section) return "Unknown";

  return section
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
