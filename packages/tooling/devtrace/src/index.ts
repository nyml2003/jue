import type { Lane } from "@jue/shared";

export interface DevTraceEvent {
  readonly kind: "signal-write" | "channel-publish" | "resource" | "navigation" | "docsgen" | "lane" | "dirty" | "flush" | "region";
  readonly lane?: Lane;
  readonly message: string;
  readonly detail?: Record<string, unknown>;
  readonly timestamp: string;
}

export interface DevTraceCollector {
  record(event: Omit<DevTraceEvent, "timestamp">): DevTraceEvent;
  read(): readonly DevTraceEvent[];
  clear(): void;
  format(): string;
}

export function createDevTraceCollector(): DevTraceCollector {
  const events: DevTraceEvent[] = [];

  return {
    record(event) {
      const entry: DevTraceEvent = {
        ...event,
        timestamp: new Date().toISOString()
      };
      events.push(entry);
      return entry;
    },
    read() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
    format() {
      return events
        .map(event => `[${event.timestamp}] ${event.kind}${event.lane === undefined ? "" : ` lane=${event.lane}`}: ${event.message}`)
        .join("\n");
    }
  };
}

export function traceSignalWrite(
  collector: DevTraceCollector,
  slot: number,
  lane: Lane,
  value: unknown
): DevTraceEvent {
  return collector.record({
    kind: "signal-write",
    lane,
    message: `signal slot ${slot} updated`,
    detail: { slot, value }
  });
}

export function traceChannelPublish(
  collector: DevTraceCollector,
  channel: string,
  lane: Lane,
  version: number
): DevTraceEvent {
  return collector.record({
    kind: "channel-publish",
    lane,
    message: `channel ${channel} published version ${version}`,
    detail: { channel, version }
  });
}

export function traceResourceEvent(
  collector: DevTraceCollector,
  slot: number,
  lane: Lane,
  status: "pending" | "ready" | "error"
): DevTraceEvent {
  return collector.record({
    kind: "resource",
    lane,
    message: `resource slot ${slot} is ${status}`,
    detail: { slot, status }
  });
}

export function traceNavigation(
  collector: DevTraceCollector,
  href: string
): DevTraceEvent {
  return collector.record({
    kind: "navigation",
    message: `navigated to ${href}`,
    detail: { href }
  });
}

export function traceLaneSchedule(
  collector: DevTraceCollector,
  lane: Lane,
  queue: "binding" | "region" | "channel" | "resource"
): DevTraceEvent {
  return collector.record({
    kind: "lane",
    lane,
    message: `scheduled ${queue} work on lane ${lane}`,
    detail: { queue }
  });
}

export function traceDirtyMark(
  collector: DevTraceCollector,
  slot: number,
  kind: "binding" | "region"
): DevTraceEvent {
  return collector.record({
    kind: "dirty",
    message: `marked ${kind} slot ${slot} dirty`,
    detail: { slot, kind }
  });
}

export function traceFlush(
  collector: DevTraceCollector,
  lane: Lane,
  flushedBindingCount: number
): DevTraceEvent {
  return collector.record({
    kind: "flush",
    lane,
    message: `flushed ${flushedBindingCount} bindings on lane ${lane}`,
    detail: { flushedBindingCount }
  });
}

export function traceRegionLifecycle(
  collector: DevTraceCollector,
  slot: number,
  regionType: string,
  lifecycle: "attach" | "switch" | "update" | "clear" | "dispose"
): DevTraceEvent {
  return collector.record({
    kind: "region",
    message: `${regionType} region ${slot} ${lifecycle}`,
    detail: { slot, regionType, lifecycle }
  });
}

export function traceDocsGeneration(
  collector: DevTraceCollector,
  artifact: string
): DevTraceEvent {
  return collector.record({
    kind: "docsgen",
    message: `generated docs artifact ${artifact}`,
    detail: { artifact }
  });
}
