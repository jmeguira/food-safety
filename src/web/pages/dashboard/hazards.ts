import type { Hazard } from "../../../shared/recall";

/** Plain-word names for the hazards. */
export const hazardLabel: Record<Hazard, string> = {
  listeria: "Listeria",
  salmonella: "Salmonella",
  "e-coli": "E. coli",
  "other-pathogen": "Other pathogen",
  allergen: "Undeclared allergen",
  "foreign-material": "Foreign material",
  chemical: "Chemical contamination",
  sterility: "Sterility",
  potency: "Potency",
  cgmp: "Manufacturing practices",
  "device-defect": "Device defect",
  labeling: "Labeling",
  other: "Other",
};
