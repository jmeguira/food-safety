import type { Recall, RecallSource } from "../shared/recall.js";
import { fetchAnnouncements, normalizeAnnouncement, type Announcement } from "./announcements.js";
import { fetchEndpoint, normalizeReport, type Endpoint, type FetchFn, type OpenFdaReport } from "./openfda.js";

export interface Source {
  id: RecallSource;
  /** `previous` holds this source's records from the last snapshot. */
  fetch(fetchFn: FetchFn, previous: Recall[]): Promise<unknown[]>;
  normalize(raw: unknown): Recall;
}

const openFda = (endpoint: Endpoint): Source => ({
  id: `openfda-${endpoint}`,
  fetch: (fetchFn) => fetchEndpoint(endpoint, fetchFn),
  normalize: (raw) => normalizeReport(endpoint, raw as OpenFdaReport),
});

const announcements: Source = {
  id: "fda-announcement",
  fetch: (fetchFn, previous) => fetchAnnouncements(fetchFn, previous),
  normalize: (raw) => normalizeAnnouncement(raw as Announcement),
};

export const SOURCES: Source[] = [openFda("food"), openFda("drug"), openFda("device"), announcements];
