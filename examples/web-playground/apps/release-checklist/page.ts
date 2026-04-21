import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  blueprint,
  handlers as compiledHandlers,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

const handlers = compiledHandlers as {
  readonly getOpenRunbookCount: () => number;
  readonly getNotifyOpsCount: () => number;
};

export interface MountedReleaseChecklist {
  getOpenRunbookCount(): number;
  getNotifyOpsCount(): number;
  dispose(): Result<void, ReleaseChecklistError>;
}

export interface ReleaseChecklistError {
  readonly code: string;
  readonly message: string;
}

export function mountReleaseChecklist(root: Node): Result<MountedReleaseChecklist, ReleaseChecklistError> {
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
    getOpenRunbookCount() {
      return handlers.getOpenRunbookCount();
    },
    getNotifyOpsCount() {
      return handlers.getNotifyOpsCount();
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}

