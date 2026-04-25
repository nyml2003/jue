import { err, ok, type Result } from "@jue/shared";
import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

export interface MountedAccountOverview {
  getOpenInvoicesCount(): number;
  getScheduleReviewCount(): number;
  dispose(): Result<void, AccountOverviewError>;
}

export interface AccountOverviewError {
  readonly code: string;
  readonly message: string;
}

export function mountAccountOverview(root: Node): Result<MountedAccountOverview, AccountOverviewError> {
  const runtime = createRuntime();
  const handlers = runtime.handlers as {
    readonly getOpenInvoicesCount: () => number;
    readonly getScheduleReviewCount: () => number;
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
    getOpenInvoicesCount() {
      return handlers.getOpenInvoicesCount();
    },
    getScheduleReviewCount() {
      return handlers.getScheduleReviewCount();
    },
    dispose() {
      return mountedResult.value.mountedTree.dispose();
    }
  });
}
