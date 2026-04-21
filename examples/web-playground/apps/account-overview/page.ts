import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  blueprint,
  handlers as compiledHandlers,
  initialSignalValues,
  signalCount
} from "./generated/page.generated";

const handlers = compiledHandlers as {
  readonly getOpenInvoicesCount: () => number;
  readonly getScheduleReviewCount: () => number;
};

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
    getOpenInvoicesCount() {
      return handlers.getOpenInvoicesCount();
    },
    getScheduleReviewCount() {
      return handlers.getScheduleReviewCount();
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}

