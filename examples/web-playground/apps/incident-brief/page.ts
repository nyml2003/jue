import { err, ok, type Result } from "@jue/shared";
import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

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
  const runtime = createRuntime();
  const handlers = runtime.handlers as {
    readonly getAcknowledgeCount: () => number;
    readonly getPageTimelineCount: () => number;
  };
  const mountedResult = mountCompiledModule({
    root,
    blueprint,
    signalCount,
    initialSignalValues,
    handlers
  });
  if (!mountedResult.ok) {
    return err(mountedResult.error);
  }

  return ok({
    getAcknowledgeCount() {
      return handlers.getAcknowledgeCount();
    },
    getPageTimelineCount() {
      return handlers.getPageTimelineCount();
    },
    dispose() {
      return mountedResult.value.mountedTree.dispose();
    }
  });
}
