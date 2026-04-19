import type {
  HostAdapter,
  HostAdapterError,
  HostEventHandler,
  HostNode,
  HostRoot
} from "@jue/runtime-core";
import { err, type Result, type HostEventKey, type HostPrimitive, type HostPropKey, type HostStyleKey } from "@jue/shared";

function notImplemented(method: string): Result<never, HostAdapterError> {
  return err({
    code: "NOT_IMPLEMENTED",
    message: `WebHostAdapter.${method}() is not implemented yet.`
  });
}

export class WebHostAdapter implements HostAdapter {
  createNode(_type: HostPrimitive, _propsIndex: number): Result<HostNode, HostAdapterError> {
    return notImplemented("createNode");
  }

  createText(_value: string): Result<HostNode, HostAdapterError> {
    return notImplemented("createText");
  }

  insert(_parent: HostNode | HostRoot, _node: HostNode, _anchor: HostNode | null): Result<void, HostAdapterError> {
    return notImplemented("insert");
  }

  remove(_parent: HostNode | HostRoot, _node: HostNode): Result<void, HostAdapterError> {
    return notImplemented("remove");
  }

  setText(_node: HostNode, _value: string): Result<void, HostAdapterError> {
    return notImplemented("setText");
  }

  setProp(_node: HostNode, _prop: HostPropKey, _value: unknown): Result<void, HostAdapterError> {
    return notImplemented("setProp");
  }

  setStyle(_node: HostNode, _styleKey: HostStyleKey, _value: unknown): Result<void, HostAdapterError> {
    return notImplemented("setStyle");
  }

  setEvent(
    _node: HostNode,
    _eventKey: HostEventKey,
    _handler: HostEventHandler | null
  ): Result<void, HostAdapterError> {
    return notImplemented("setEvent");
  }
}

export function createWebHostAdapter(): HostAdapter {
  return new WebHostAdapter();
}
