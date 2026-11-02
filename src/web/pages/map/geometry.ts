import { geoAlbersUsa, geoPath } from "d3-geo";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import { feature } from "topojson-client";
import atlas from "us-atlas/states-10m.json";
import { STATES } from "../../../shared/states";

export const WIDTH = 960;
export const HEIGHT = 600;

const topology = atlas as unknown as Topology<{ states: GeometryCollection }>;
const collection = feature(topology, topology.objects.states) as FeatureCollection;
const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], collection);
const path = geoPath(projection);

const byFips = new Map(STATES.map((s) => [s.fips, s]));

/** One drawn shape per state `geoAlbersUsa` can place; us-atlas keys states by FIPS, joined here to USPS codes. */
export const shapes: { code: string; name: string; d: string }[] = collection.features.flatMap((f) => {
  const state = byFips.get(String(f.id));
  const d = path(f);
  return state && d ? [{ code: state.code, name: state.name, d }] : [];
});
