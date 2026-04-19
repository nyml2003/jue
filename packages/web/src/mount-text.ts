import {
  createBlueprint,
  type FlushBindingsResult
} from "@jue/runtime-core";
import { BindingOpcode, Lane, err, ok, type Result } from "@jue/shared";

import { createWebHostAdapter } from "./adapter";
import { mountBlock, type MountBlockError } from "./mount-block";

export interface MountTextOptions {
  readonly lane?: Lane;
}

export interface MountedText {
  readonly node: Text;
  set(value: unknown, lane?: Lane): Result<FlushBindingsResult, MountTextError>;
  dispose(): Result<void, MountTextError>;
}

export interface MountTextError {
  readonly code: string;
  readonly message: string;
}

export function mountText(
  root: Node,
  initialValue: unknown,
  options: MountTextOptions = {}
): Result<MountedText, MountTextError> {
  const blueprintResult = createTextBlueprint();
  if (!blueprintResult.ok) {
    return err(blueprintResult.error);
  }

  const mountBlockInput = {
    blueprint: blueprintResult.value,
    signalCount: 1,
    root,
    createNode() {
      const adapter = createWebHostAdapter();
      return adapter.createText("");
    }
  };

  const mountedBlockResult = options.lane === undefined
    ? mountBlock(mountBlockInput)
    : mountBlock({
      ...mountBlockInput,
      lane: options.lane
    });

  if (!mountedBlockResult.ok) {
    return err(mountedBlockResult.error);
  }

  const mountedBlock = mountedBlockResult.value;
  const textNode = mountedBlock.node as unknown as Text;

  const mountedText: MountedText = {
    node: textNode,
    set(value, lane = options.lane ?? Lane.VISIBLE_UPDATE) {
      return mountedBlock.setSignal(0, value, lane);
    },
    dispose() {
      return mountedBlock.dispose();
    }
  };

  const initialCommitResult = mountedText.set(initialValue, options.lane);
  if (!initialCommitResult.ok) {
    return initialCommitResult;
  }

  return ok(mountedText);
}

function createTextBlueprint() {
  return createBlueprint({
    nodeCount: 1,
    bindingOpcode: new Uint8Array([BindingOpcode.TEXT]),
    bindingNodeIndex: new Uint32Array([0]),
    bindingDataIndex: new Uint32Array([0]),
    regionType: new Uint8Array(0),
    regionAnchorStart: new Uint32Array(0),
    regionAnchorEnd: new Uint32Array(0),
    signalToBindingStart: new Uint32Array([0]),
    signalToBindingCount: new Uint32Array([1]),
    signalToBindings: new Uint32Array([0])
  });
}
