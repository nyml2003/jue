// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mountIncidentBrief } from "./page";

describe("@jue/example-app incident-brief", () => {
  it("mounts the incident brief app with the conditional banner and active handlers", () => {
    const root = document.createElement("div");
    const mountedResult = mountIncidentBrief(root);

    expect(mountedResult.ok).toBe(true);
    if (!mountedResult.ok) {
      return;
    }

    expect(root.textContent).toContain("API latency brief");
    expect(root.textContent).toContain("Escalation remains open while p95 stays above 900 ms.");
    expect(root.textContent).toContain("Current mitigation");

    const buttons = root.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    buttons[0]?.click();
    buttons[1]?.click();

    expect(mountedResult.value.getAcknowledgeCount()).toBe(1);
    expect(mountedResult.value.getPageTimelineCount()).toBe(1);

    const disposeResult = mountedResult.value.dispose();
    expect(disposeResult.ok).toBe(true);
    expect(root.childNodes).toHaveLength(0);
  });
});

