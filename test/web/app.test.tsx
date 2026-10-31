// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { App } from "../../src/web/App";

afterEach(cleanup);

it("renders the map page at / and the dashboard at /dashboard", () => {
  window.history.pushState({}, "", "/");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Map" })).toBeTruthy();
  cleanup();
  window.history.pushState({}, "", "/dashboard");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
});
