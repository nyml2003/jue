import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  blueprint,
  handlers as compiledHandlers,
  initialSignalValues,
  signalCount
} from "./compiler-canary.generated";

const handlers = compiledHandlers as {
  readonly handleClickPressCount: () => number;
};

export interface MountedCompilerCanary {
  getPressCount(): number;
  dispose(): Result<void, CompilerCanaryError>;
}

export interface CompilerCanaryError {
  readonly code: string;
  readonly message: string;
}

export function mountCompilerCanary(root: Node): Result<MountedCompilerCanary, CompilerCanaryError> {
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
    getPressCount() {
      return handlers.handleClickPressCount();
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}
