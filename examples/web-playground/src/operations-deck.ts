import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

import {
  blueprint,
  handlers as compiledHandlers,
  initialSignalValues,
  signalCount
} from "./operations-deck.generated";

const handlers = compiledHandlers as {
  readonly getPrimaryActionCount: () => number;
  readonly getSyncActionCount: () => number;
  readonly getEscalateActionCount: () => number;
};

export interface MountedOperationsDeck {
  getPrimaryActionCount(): number;
  getSyncActionCount(): number;
  getEscalateActionCount(): number;
  dispose(): Result<void, OperationsDeckError>;
}

export interface OperationsDeckError {
  readonly code: string;
  readonly message: string;
}

export function mountOperationsDeck(root: Node): Result<MountedOperationsDeck, OperationsDeckError> {
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
    getPrimaryActionCount() {
      return handlers.getPrimaryActionCount();
    },
    getSyncActionCount() {
      return handlers.getSyncActionCount();
    },
    getEscalateActionCount() {
      return handlers.getEscalateActionCount();
    },
    dispose() {
      return mountedResult.value.dispose();
    }
  });
}
