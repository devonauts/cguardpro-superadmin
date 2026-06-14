import type { TrainingCategory, TrainingLevel } from "@/types";

export const CATEGORY_OPTIONS: { key: TrainingCategory; label: string }[] = [
  { key: "security", label: "Security" },
  { key: "compliance", label: "Compliance" },
  { key: "skills", label: "Skills" },
  { key: "safety", label: "Safety" },
  { key: "other", label: "Other" },
];

export const LEVEL_OPTIONS: { key: TrainingLevel; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

export function categoryLabel(c: string | null | undefined): string {
  return CATEGORY_OPTIONS.find((o) => o.key === c)?.label || "—";
}

export function levelLabel(l: string | null | undefined): string {
  return LEVEL_OPTIONS.find((o) => o.key === l)?.label || "—";
}
