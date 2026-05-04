import type { Blueprint } from "@jue/runtime-core";
import { err, ok, type Result } from "@jue/shared";

import type { MountBlockError } from "./mount-block";
import { mountTree, type MountedTree } from "./mount-tree";

export interface SignalRuntimeBridge {
  read(name: string): unknown;
  write(name: string, value: unknown): void;
  update(name: string, updater: (value: unknown) => unknown): void;
}

export interface MountCompiledModuleInput<THandlers> {
  readonly root: Node;
  readonly blueprint: Blueprint;
  readonly signalCount: number;
  readonly initialSignalValues?: readonly unknown[];
  readonly signalSlots?: Readonly<Record<string, number>>;
  readonly configureSignalRuntime?: (runtime: SignalRuntimeBridge) => void;
  readonly handlers: THandlers;
}

export interface MountedCompiledModule<THandlers> {
  readonly mountedTree: MountedTree;
  readonly handlers: THandlers;
}

interface LifecycleHandlers {
  mount?: () => void;
  dispose?: () => void;
}

const activeSignalModules = new WeakSet<NonNullable<MountCompiledModuleInput<unknown>["configureSignalRuntime"]>>();

export function mountCompiledModule<THandlers>(
  input: MountCompiledModuleInput<THandlers>
): Result<MountedCompiledModule<THandlers>, MountBlockError> {
  if (input.configureSignalRuntime && activeSignalModules.has(input.configureSignalRuntime)) {
    return err({
      code: "COMPILED_MODULE_ALREADY_MOUNTED",
      message: "This compiled module already has an active signal runtime. Dispose the current mount before mounting it again."
    });
  }

  const mountedResult = mountTree({
    blueprint: resolveHandlerBlueprint(input.blueprint, input.handlers),
    root: input.root,
    signalCount: input.signalCount,
    ...(input.initialSignalValues === undefined
      ? {}
      : { initialSignalValues: input.initialSignalValues })
  });
  if (!mountedResult.ok) {
    return err(mountedResult.error);
  }

  const flushResult = mountedResult.value.flushInitialBindings();
  if (!flushResult.ok) {
    return err(flushResult.error);
  }

  if (input.configureSignalRuntime && input.signalSlots) {
    input.configureSignalRuntime(createSignalRuntimeBridge(mountedResult.value, input.signalSlots));
    activeSignalModules.add(input.configureSignalRuntime);
  }

  const lifecycle = resolveLifecycleHandlers(input.handlers);
  if (lifecycle.mount) {
    try {
      lifecycle.mount();
    } catch (errorValue) {
      const cleanupResult = cleanupFailedMount(
        mountedResult.value,
        lifecycle.dispose,
        input.configureSignalRuntime
      );
      if (!cleanupResult.ok) {
        return cleanupResult;
      }

      return err({
        code: "COMPILED_MODULE_LIFECYCLE_FAILED",
        message: errorValue instanceof Error ? errorValue.message : String(errorValue)
      });
    }
  }

  const mountedTree = wrapMountedTreeDispose(
    mountedResult.value,
    lifecycle.dispose,
    input.configureSignalRuntime
      ? () => {
        activeSignalModules.delete(input.configureSignalRuntime!);
      }
      : undefined
  );

  return ok({
    mountedTree,
    handlers: input.handlers
  });
}

const HANDLER_MARKER_PREFIX = "__jue_handler__:";

function resolveHandlerBlueprint<THandlers>(
  blueprint: Blueprint,
  handlers: THandlers
): Blueprint {
  if (!handlers || typeof handlers !== "object") {
    return blueprint;
  }

  let changed = false;
  const bindingArgRef = blueprint.bindingArgRef.map(value => {
    if (typeof value !== "string" || !value.startsWith(HANDLER_MARKER_PREFIX)) {
      return value;
    }

    const name = value.slice(HANDLER_MARKER_PREFIX.length);
    const handler = (handlers as Record<string, unknown>)[name];
    if (typeof handler !== "function") {
      return value;
    }

    changed = true;
    return handler;
  });

  if (!changed) {
    return blueprint;
  }

  return {
    ...blueprint,
    bindingArgRef
  };
}

function createSignalRuntimeBridge(
  mountedTree: MountedTree,
  signalSlots: Readonly<Record<string, number>>
): SignalRuntimeBridge {
  return {
    read(name: string) {
      const slot = signalSlots[name];
      return slot === undefined ? undefined : mountedTree.instance.signalValues[slot];
    },
    write(name: string, value: unknown) {
      const slot = signalSlots[name];
      if (slot !== undefined) {
        void mountedTree.setSignal(slot, value);
      }
    },
    update(name: string, updater: (value: unknown) => unknown) {
      const slot = signalSlots[name];
      if (slot !== undefined) {
        const current = mountedTree.instance.signalValues[slot];
        void mountedTree.setSignal(slot, updater(current));
      }
    }
  };
}

function resolveLifecycleHandlers<THandlers>(handlers: THandlers): LifecycleHandlers {
  if (!handlers || typeof handlers !== "object") {
    return {};
  }

  const value = handlers as {
    readonly mount?: unknown;
    readonly dispose?: unknown;
  };

  return {
    ...(typeof value.mount === "function" ? { mount: value.mount as () => void } : {}),
    ...(typeof value.dispose === "function" ? { dispose: value.dispose as () => void } : {})
  };
}

function wrapMountedTreeDispose(
  mountedTree: MountedTree,
  beforeDispose?: () => void,
  afterDispose?: () => void
): MountedTree {
  const originalDispose = mountedTree.dispose.bind(mountedTree);

  mountedTree.dispose = () => {
    try {
      beforeDispose?.();
    } catch (errorValue) {
      return err({
        code: "COMPILED_MODULE_LIFECYCLE_FAILED",
        message: errorValue instanceof Error ? errorValue.message : String(errorValue)
      });
    }

    const result = originalDispose();
    if (result.ok) {
      afterDispose?.();
    }

    return result;
  };

  return mountedTree;
}

function cleanupFailedMount(
  mountedTree: MountedTree,
  disposeLifecycle: (() => void) | undefined,
  configureSignalRuntime: MountCompiledModuleInput<unknown>["configureSignalRuntime"]
): Result<void, MountBlockError> {
  try {
    disposeLifecycle?.();
  } catch (errorValue) {
    return err({
      code: "COMPILED_MODULE_LIFECYCLE_FAILED",
      message: errorValue instanceof Error ? errorValue.message : String(errorValue)
    });
  }

  const disposeResult = mountedTree.dispose();
  if (!disposeResult.ok) {
    return err(disposeResult.error);
  }

  if (configureSignalRuntime) {
    activeSignalModules.delete(configureSignalRuntime);
  }

  return ok(undefined);
}
