import type { SeverityClass } from "../shared/severity";

export interface Severity {
  label: string;
  color: string;
  meaning: string;
}

// One hue in three steps, darkest for Class I; each step keeps contrast
// against both white and a dark background. Gray marks unclassified.
export const severity: Record<SeverityClass, Severity> = {
  I: {
    label: "Class I",
    color: "#1d4ed8",
    meaning: "A reasonable probability of serious adverse health consequences or death.",
  },
  II: {
    label: "Class II",
    color: "#3b82f6",
    meaning:
      "Temporary or medically reversible adverse health consequences, or a remote probability of serious ones.",
  },
  III: {
    label: "Class III",
    color: "#7aa7f7",
    meaning: "Not likely to cause adverse health consequences.",
  },
  unclassified: {
    label: "Unclassified",
    color: "#8a8f98",
    meaning: "Announced, not yet classified.",
  },
};
