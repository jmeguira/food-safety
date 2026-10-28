import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDistribution, type Distribution } from "../src/ingest/distribution.js";
import { STATES } from "../src/shared/states.js";

interface Case {
  text: string;
  expected: Distribution;
}

const cases: Case[] = JSON.parse(
  readFileSync(new URL("./fixtures/distribution.json", import.meta.url), "utf8"),
);

const nationwideStates = STATES.filter((s) => !["AS", "GU", "MP", "PR", "VI"].includes(s.code)).map((s) => s.code);

describe("parseDistribution on recorded openFDA texts", () => {
  it.each(cases.map((c) => [c.text.slice(0, 80), c] as const))("%s", (_name, c) => {
    expect(parseDistribution(c.text)).toEqual(c.expected);
  });
});

describe("states", () => {
  it("lists 50 states, DC and 5 territories with unique USPS and FIPS codes", () => {
    expect(STATES).toHaveLength(56);
    expect(new Set(STATES.map((s) => s.code)).size).toBe(56);
    expect(new Set(STATES.map((s) => s.fips)).size).toBe(56);
    for (const s of STATES) {
      expect(s.code).toMatch(/^[A-Z]{2}$/);
      expect(s.fips).toMatch(/^\d{2}$/);
    }
  });

  it("carries the FIPS codes the map joins on", () => {
    const fips = Object.fromEntries(STATES.map((s) => [s.code, s.fips]));
    expect(fips).toMatchObject({ AL: "01", CA: "06", DC: "11", NY: "36", WY: "56", PR: "72", GU: "66" });
  });
});

describe("nationwide", () => {
  it.each(["Nationwide", "US Nationwide distribution.", "distributed nationally", "Worldwide", "all 50 states"])(
    "%s fills every state",
    (text) => {
      const r = parseDistribution(text);
      expect(r.nationwide).toBe(true);
      expect(r.states).toEqual(nationwideStates);
      expect(r.unclear).toBe(false);
    },
  );

  it("treats worldwide as foreign too", () => {
    expect(parseDistribution("Worldwide")).toMatchObject({ nationwide: true, foreign: true });
    expect(parseDistribution("Nationwide")).toMatchObject({ nationwide: true, foreign: false });
  });
});

describe("state names and codes", () => {
  it("reads codes and names", () => {
    expect(parseDistribution("CA, NV, and AZ").states).toEqual(["AZ", "CA", "NV"]);
    expect(parseDistribution("Product was shipped to: Alabama, Georgia, Florida").states).toEqual(["AL", "FL", "GA"]);
    expect(parseDistribution("one consignee in TX").states).toEqual(["TX"]);
  });

  it("does not read two-letter words in ordinary text as states", () => {
    const r = parseDistribution("Shipped in bulk to me or hi, oh, ok, pa and de, in the east");
    expect(r.states).toEqual([]);
    expect(r.unclear).toBe(true);
    expect(parseDistribution("Distributed in PA or OH").states).toEqual(["OH", "PA"]);
  });

  it("matches codes only as whole words", () => {
    expect(parseDistribution("PAT, CAN and TXT").states).toEqual([]);
  });

  it("keeps West Virginia apart from Virginia, and DC apart from Washington", () => {
    expect(parseDistribution("West Virginia").states).toEqual(["WV"]);
    expect(parseDistribution("virginia and west virginia").states).toEqual(["VA", "WV"]);
    expect(parseDistribution("Washington, DC").states).toEqual(["DC"]);
    expect(parseDistribution("Washington D.C.").states).toEqual(["DC"]);
    expect(parseDistribution("D.C.").states).toEqual(["DC"]);
    expect(parseDistribution("Washington and Washington, D.C.").states).toEqual(["DC", "WA"]);
  });

  it("keeps New Mexico apart from Mexico", () => {
    expect(parseDistribution("New Mexico")).toMatchObject({ states: ["NM"], foreign: false });
  });
});

describe("foreign and unclear", () => {
  it("reads OUS lists as countries, not states", () => {
    expect(parseDistribution("US: NY, NJ. OUS: Canada")).toMatchObject({ states: ["NJ", "NY"], foreign: true });
    expect(parseDistribution("US: NY OUS: IN, KR, CA")).toMatchObject({ states: ["NY"], foreign: true });
  });

  it("flags a country alone as foreign, not unclear", () => {
    expect(parseDistribution("Canada and Mexico")).toMatchObject({ states: [], foreign: true, unclear: false });
  });

  it("does not flag a denial of foreign distribution", () => {
    expect(parseDistribution("CA only. No foreign distribution.")).toMatchObject({ states: ["CA"], foreign: false });
  });

  it("flags text naming no place as unclear", () => {
    expect(parseDistribution("Distributors and retail stores")).toEqual({
      states: [],
      nationwide: false,
      foreign: false,
      unclear: true,
    });
    expect(parseDistribution("")).toMatchObject({ unclear: true });
  });
});
