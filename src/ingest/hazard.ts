import type { Hazard, RecallCategory } from "../shared/recall.js";

/** Words that name a hazard, in priority order: the first rule that matches wins. */
const RULES: [Hazard, RegExp][] = [
  ["listeria", /listeria|monocytogenes/],
  ["salmonella", /salmonella/],
  ["e-coli", /e\. ?coli|escherichia|\bstec\b/],
  [
    "other-pathogen",
    /botulis|botulinum|clostridium|hepatitis|cyclospora|norovirus|\bmou?lds?\b|\bfung(us|al)\b|staphylococc|bacillus cereus|campylobacter|shigella|vibrio|cronobacter/,
  ],
  [
    "allergen",
    /allergen|(undeclared|not declared|not listed|failed to (declare|list)|may contain|contains)[^.]*\b(milk|dairy|eggs?|peanuts?|tree ?nuts?|almonds?|walnuts?|pecans?|cashews?|hazelnuts?|pistachios?|wheat|gluten|soy|soybeans?|fish|shellfish|crustaceans?|shrimp|sesame)\b/,
  ],
  [
    "foreign-material",
    /foreign (material|matter|object|body|bodies|substance)|\bglass\b|metal (fragment|piece|shaving|particle)|\bplastic\b|particulate|\bbone (fragment|piece)|\bwood\b/,
  ],
  [
    "chemical",
    /(?<!\b(?:could|may|might|can|to|will|would) )\blead\b(?! to\b)|pesticide|chemical|toxin|melamine|arsenic|cadmium|mercury|benzene|nitrosamine|heavy metal/,
  ],
  ["sterility", /sterility|non-?sterile|unsterile|sterilization/],
  ["potency", /sub-?potent|super-?potent|potency|dissolution/],
  ["cgmp", /cgmp|good manufacturing/],
  ["labeling", /mislabel|misbrand|label|undeclared|warning|not (declared|listed)/],
];

/** Device wording that names a defect; a device reason is checked for it ahead of labeling, a food or drug reason never. */
const DEVICE_DEFECT = /malfunction|software|firmware|design|defect|\bleak|erroneous|inaccurate/;

/** The one hazard a recall's reason names; `other` when it names none. */
export function hazardOf(reason: string, category: RecallCategory): Hazard {
  const text = reason.toLowerCase();
  for (const [hazard, pattern] of RULES) {
    if (hazard === "labeling" && category === "device" && DEVICE_DEFECT.test(text)) return "device-defect";
    if (pattern.test(text)) return hazard;
  }
  return category === "device" && DEVICE_DEFECT.test(text) ? "device-defect" : "other";
}
