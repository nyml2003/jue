import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_WEB_PLAYGROUND_APPS_ROOT, createExampleAppDefinition, getExampleAppDefinition, listExampleApps } from "../src/examples";

describe("@jue/lab/examples", () => {
  it("lists the current web playground apps as stable example definitions", async () => {
    const examples = await listExampleApps();

    expect(examples.map(example => example.id)).toEqual([
      "account-overview",
      "incident-brief",
      "keyed-list-lab",
      "release-checklist",
      "router-query-lab",
      "stream-lab",
      "virtual-list-lab"
    ]);
    expect(examples[0]?.componentPath).toContain("page.component.tsx");
    expect(examples[0]?.generatedModulePath).toContain("generated");
  });

  it("resolves example definitions by id", async () => {
    const example = await getExampleAppDefinition("virtual-list-lab");

    expect(example?.e2eTestPath).toContain("page.spec.ts");
    expect(example?.distRoot).toContain("dist");
  });

  it("creates path conventions from an app root", () => {
    const example = createExampleAppDefinition(join(DEFAULT_WEB_PLAYGROUND_APPS_ROOT, "virtual-list-lab"));

    expect(example.id).toBe("virtual-list-lab");
    expect(example.runtimeEntryPath).toContain("page.ts");
  });
});
