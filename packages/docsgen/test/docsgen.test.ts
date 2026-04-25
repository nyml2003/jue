import { describe, expect, it } from "vitest";

import { generateCoreSpecSnippet, generateExampleRegistrySnippet, generatePhase2PackageMatrix } from "../src/index";

describe("@jue/docsgen", () => {
  it("generates a primitive support matrix", async () => {
    const output = await generatePhase2PackageMatrix();

    expect(output).toContain("Phase 2 Package Matrix");
    expect(output).toContain("Compiled fixtures: 7");
    expect(output).toContain("| Show | yes |");
  });

  it("generates an example registry snippet", async () => {
    const output = await generateExampleRegistrySnippet();

    expect(output).toContain("virtual-list-lab");
    expect(output).toContain("account-overview");
    expect(output).toContain("Fixture Summary");
  });

  it("generates a core spec snippet", async () => {
    const output = await generateCoreSpecSnippet();

    expect(output).toContain("Core Spec Index");
    expect(output).toContain("runtime-model.md");
  });
});
