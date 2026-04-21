import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  blueprint,
  handlers as compiledHandlers,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

const handlers = compiledHandlers as {
  readonly getAcknowledgeCount: () => number;
  readonly getPageTimelineCount: () => number;
};

export interface MountedIncidentBrief {
  getAcknowledgeCount(): number;
  getPageTimelineCount(): number;
  dispose(): Result<void, IncidentBriefError>;
}

export interface IncidentBriefError {
  readonly code: string;
  readonly message: string;
}

export function mountIncidentBrief(root: Node): Result<MountedIncidentBrief, IncidentBriefError> {
  const mountedResult = mountTree({
    blueprint,
    root,
    signalCount,
    initialSignalValues
  });
  if (!mountedResult.ok) {
    return err(mountedResult.error);
  }

  const flushResult = mountedResult.value.flushInitialBindings();
  if (!flushResult.ok) {
    return err(flushResult.error);
  }

  return ok({
    getAcknowledgeCount() {
      return handlers.getAcknowledgeCount();
    },
    getPageTimelineCount() {
      return handlers.getPageTimelineCount();
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}

