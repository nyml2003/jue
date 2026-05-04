import { describe, expect, it } from "vitest";

import { compileAllExampleFixtures, compileExampleFixture, compileFixtureSource, loadExampleFixtureSource } from "../src/index";

describe("@jue/testkit", () => {
  it("loads example fixture sources from the registry", async () => {
    const source = await loadExampleFixtureSource("account-overview");

    expect(source.ok).toBe(true);
    if (!source.ok) {
      return;
    }

    expect(source.value.source).toContain("signal");
  });

  it("compiles individual example fixtures and summarizes their descriptors", async () => {
    const fixture = await compileExampleFixture("virtual-list-lab");

    expect(fixture.ok).toBe(true);
    if (!fixture.ok) {
      return;
    }

    expect(fixture.value.summary.virtualListDescriptorCount).toBe(1);
    expect(fixture.value.summary.bindingCount).toBeGreaterThan(0);
    expect(compileFixtureSource(fixture.value.source).ok).toBe(true);
  });

  it("compiles the current example suite as a fixture batch", async () => {
    const fixtures = await compileAllExampleFixtures();

    expect(fixtures.ok).toBe(true);
    if (!fixtures.ok) {
      return;
    }

    expect(fixtures.value).toHaveLength(7);
  });
});
