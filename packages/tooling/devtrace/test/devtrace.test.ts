import { describe, expect, it } from "vitest";

import {
  createDevTraceCollector,
  traceChannelPublish,
  traceDirtyMark,
  traceDocsGeneration,
  traceFlush,
  traceLaneSchedule,
  traceNavigation,
  traceRegionLifecycle,
  traceResourceEvent,
  traceSignalWrite
} from "../src/index";

describe("@jue/devtrace", () => {
  it("records and formats trace events", () => {
    const collector = createDevTraceCollector();

    traceSignalWrite(collector, 1, 1, "hello");
    traceChannelPublish(collector, "saveDone", 2, 3);
    traceResourceEvent(collector, 0, 1, "ready");
    traceNavigation(collector, "/issues/42");
    traceLaneSchedule(collector, 1, "binding");
    traceDirtyMark(collector, 3, "binding");
    traceFlush(collector, 1, 2);
    traceRegionLifecycle(collector, 0, "Show", "switch");
    traceDocsGeneration(collector, "phase-2-matrix.md");

    expect(collector.read()).toHaveLength(9);
    expect(collector.format()).toContain("signal slot 1 updated");
    expect(collector.format()).toContain("scheduled binding work");
    expect(collector.format()).toContain("Show region 0 switch");
    expect(collector.format()).toContain("phase-2-matrix.md");
  });
});
