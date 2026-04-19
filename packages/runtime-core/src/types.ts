import type {
  HostEventKey,
  HostPrimitive,
  HostPropKey,
  HostStyleKey,
  Result
} from "@jue/shared";

export interface HostNode {
  readonly __hostNodeBrand: unique symbol;
}

export interface HostRoot {
  readonly __hostRootBrand: unique symbol;
}
export type HostEventHandler = (event: unknown) => void;

export interface Blueprint {
  readonly nodeCount: number;
  readonly bindingCount: number;
  readonly regionCount: number;
  readonly bindingOpcode: Uint8Array;
  readonly bindingNodeIndex: Uint32Array;
  readonly bindingDataIndex: Uint32Array;
  readonly regionType: Uint8Array;
  readonly regionAnchorStart: Uint32Array;
  readonly regionAnchorEnd: Uint32Array;
  readonly signalToBindingStart: Uint32Array;
  readonly signalToBindingCount: Uint32Array;
  readonly signalToBindings: Uint32Array;
}

export interface HostAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface HostAdapter {
  createNode(type: HostPrimitive, propsIndex: number): Result<HostNode, HostAdapterError>;
  createText(value: string): Result<HostNode, HostAdapterError>;
  insert(parent: HostNode | HostRoot, node: HostNode, anchor: HostNode | null): Result<void, HostAdapterError>;
  remove(parent: HostNode | HostRoot, node: HostNode): Result<void, HostAdapterError>;
  setText(node: HostNode, value: string): Result<void, HostAdapterError>;
  setProp(node: HostNode, prop: HostPropKey, value: unknown): Result<void, HostAdapterError>;
  setStyle(node: HostNode, styleKey: HostStyleKey, value: unknown): Result<void, HostAdapterError>;
  setEvent(node: HostNode, eventKey: HostEventKey, handler: HostEventHandler | null): Result<void, HostAdapterError>;
  beginBatch?(): Result<void, HostAdapterError>;
  endBatch?(): Result<void, HostAdapterError>;
}

export interface BlockInstance {
  readonly blueprint: Blueprint;
  readonly nodes: HostNode[];
  readonly signalValues: unknown[];
  readonly signalVersion: Uint32Array;
  readonly signalFlags: Uint8Array;
  readonly regionLifecycle: Uint8Array;
  readonly resourceStatus: Uint8Array;
  readonly resourceLaneState: Uint8Array;
  readonly resourceVersion: Uint32Array;
  readonly resourcePendingCount: Uint16Array;
  readonly resourceValueRef: unknown[];
  readonly resourceErrorRef: unknown[];
  readonly dirtyBindingBits: Uint32Array;
}
