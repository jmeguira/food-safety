import { STATES, TERRITORY_CODES } from "../shared/states.js";

export interface Distribution {
  /** USPS codes, in the order of STATES. */
  states: string[];
  nationwide: boolean;
  foreign: boolean;
  /** The text names no state, no country and is not nationwide. */
  unclear: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Names are matched longest first and blanked once matched, so "West Virginia"
// is not also Virginia and "New Mexico" is not also Mexico.
const NAMES: [string, string][] = [
  ...STATES.map((s): [string, string] => [s.name, s.code]),
  ["Washington,? D\\.?C\\.?", "DC"],
  ["D\\.C\\.", "DC"],
  ["Virgin Islands", "VI"],
  ["Saipan", "MP"],
  ["Mariana Islands", "MP"],
]
  .map(([n, c]): [string, string] => [n.includes("\\") ? n : escape(n), c])
  .sort((a, b) => b[0].length - a[0].length);

// Georgia is a state here, never the country.
const COUNTRIES =
  "Afghanistan|Albania|Algeria|Antigua|Argentina|Armenia|Aruba|Australia|Austria|Azerbaijan|Bahamas|Bahrain|Bangladesh|" +
  "Barbados|Belgium|Belize|Bermuda|Bolivia|Brazil|Bulgaria|Cambodia|Canada|Cayman|Chile|China|Colombia|Costa Rica|Croatia|" +
  "Cuba|Cyprus|Czech|Denmark|Dominican Republic|Dubai|Ecuador|Egypt|El Salvador|(?<!New )England|Estonia|Finland|France|Germany|" +
  "Great Britain|Greece|Guatemala|Haiti|Holland|Honduras|Hong Kong|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|" +
  "Israel|Italy|Jamaica|Japan|Jordan|Kenya|Korea|Kuwait|Latin America|Latvia|Lebanon|Libano|Lithuania|Luxembourg|Malaysia|" +
  "Mexico|Netherlands|New Zealand|Nicaragua|Nigeria|Norway|Pakistan|Panama|Paraguay|Peru|Philippines|Poland|Portugal|" +
  "Qatar|Romania|Russia|Saudi Arabia|Scotland|Singapore|Slovakia|Slovenia|South Africa|Spain|Sweden|Switzerland|Taiwan|" +
  "Thailand|Trinidad|Turks|Uganda|Ukraine|United Arab Emirates|United Kingdom|Uruguay|Venezuela|Vietnam|EMEA";
const COUNTRY_RE = new RegExp(`\\b(?:${COUNTRIES})\\b`, "i");
const COUNTRY_ABBREVIATION_RE = /\b(?:UAE|UK)\b/;

// "No foreign distribution", "did not ship to foreign consignees", "OUS: None",
// "Foreign/VA/DOD: None" say nothing is foreign.
const NEGATED_FOREIGN = new RegExp(
  String.raw`\b(?:no|not|nor)\b[^.:;]{0,40}\b(?:foreign|international(?:ly)?|OUS|O\.U\.S\.|outside\s+(?:of\s+)?the\s+(?:US|U\.S\.|United States))\b(?:\/[A-Za-z]+)*` +
    String.raw`|\b(?:O\.?U\.?S\.?|foreign|international)(?:\/[A-Za-z]+)*(?:\s+distribution)?\s*:?\s*(?:none|n\/a)\b`,
  "gi",
);
// "DOD/VA" is the Department of Defense and Veterans Affairs, not Virginia.
const GOVERNMENT = /\b(?:DOD\/VA|VA\/DOD)\b/g;
// A foreign marker runs to the next "US:" / "Domestic:" label, so the codes in
// "OUS: IN, KR" are countries, not Indiana.
const FOREIGN_MARKER =
  /(?:\bO\.?U\.?S\.?|\b(?:foreign|international(?:ly)?)|\boutside\s+(?:of\s+)?the\s+(?:US|U\.S\.|United States))\b[^]*?(?=\b(?:U\.?S\.?|domestic|united states)\s*:|$)/gi;
const NATIONWIDE = /\b(?:nation-?wide|nationally|worldwide|global(?:ly)?|all\s+50\s+(?:U\.?S\.?\s+)?states|all states)\b/i;
const WORLDWIDE = /\b(?:worldwide|global(?:ly)?)\b/i;

const NATIONWIDE_STATES = STATES.filter((s) => !TERRITORY_CODES.has(s.code)).map((s) => s.code);
const CODES = new Set(STATES.map((s) => s.code));

export function parseDistribution(text: string): Distribution {
  let rest = text.replace(NEGATED_FOREIGN, " ").replace(GOVERNMENT, " ");
  let foreign = rest.search(FOREIGN_MARKER) >= 0 || WORLDWIDE.test(rest);
  const nationwide = NATIONWIDE.test(rest);

  rest = rest.replace(FOREIGN_MARKER, " ");

  const found = new Set<string>();
  for (const [pattern, code] of NAMES) {
    rest = rest.replace(new RegExp(`\\b${pattern}(?![A-Za-z])`, "gi"), () => {
      found.add(code);
      return " ";
    });
  }
  // Codes are upper case only, so "in", "or", "me", "ok" in prose never match.
  for (const m of rest.matchAll(/(?<![A-Za-z.])[A-Z]{2}(?![A-Za-z])/g)) {
    if (CODES.has(m[0])) found.add(m[0]);
  }

  // Countries are looked for once the states are blanked, so "New Mexico" is not Mexico.
  foreign ||= COUNTRY_RE.test(rest) || COUNTRY_ABBREVIATION_RE.test(rest);

  if (nationwide) for (const code of NATIONWIDE_STATES) found.add(code);
  const states = STATES.map((s) => s.code).filter((c) => found.has(c));
  return { states, nationwide, foreign, unclear: states.length === 0 && !nationwide && !foreign };
}
