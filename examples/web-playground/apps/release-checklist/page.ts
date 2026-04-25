import { err, ok, type Result } from "@jue/shared";
import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

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
  const runtime = createRuntime();
  const handlers = runtime.handlers as {
    readonly getOpenRunbookCount: () => number;
    readonly getNotifyOpsCount: () => number;
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
    getOpenRunbookCount() {
      return handlers.getOpenRunbookCount();
    },
    getNotifyOpsCount() {
      return handlers.getNotifyOpsCount();
    },
    dispose() {
      return mountedResult.value.mountedTree.dispose();
    }
  });
}
