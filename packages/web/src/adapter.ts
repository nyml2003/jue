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
    return createElementNode(_type);
  }

  createText(_value: string): Result<HostNode, HostAdapterError> {
    return toHostNode(document.createTextNode(_value));
  }

  insert(_parent: HostNode | HostRoot, _node: HostNode, _anchor: HostNode | null): Result<void, HostAdapterError> {
    const parentResult = toDomNode(_parent, "insert.parent");
    if (!parentResult.ok) {
      return parentResult;
    }

    const nodeResult = toDomNode(_node, "insert.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    if (_anchor === null) {
      parentResult.value.appendChild(nodeResult.value);
      return { ok: true, value: undefined, error: null };
    }

    const anchorResult = toDomNode(_anchor, "insert.anchor");
    if (!anchorResult.ok) {
      return anchorResult;
    }

    parentResult.value.insertBefore(nodeResult.value, anchorResult.value);
    return { ok: true, value: undefined, error: null };
  }

  remove(_parent: HostNode | HostRoot, _node: HostNode): Result<void, HostAdapterError> {
    const parentResult = toDomNode(_parent, "remove.parent");
    if (!parentResult.ok) {
      return parentResult;
    }

    const nodeResult = toDomNode(_node, "remove.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    parentResult.value.removeChild(nodeResult.value);
    return { ok: true, value: undefined, error: null };
  }

  setText(_node: HostNode, _value: string): Result<void, HostAdapterError> {
    const nodeResult = toDomNode(_node, "setText.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    if (nodeResult.value instanceof Text) {
      nodeResult.value.data = _value;
      return { ok: true, value: undefined, error: null };
    }

    nodeResult.value.textContent = _value;
    return { ok: true, value: undefined, error: null };
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

function createElementNode(type: HostPrimitive): Result<HostNode, HostAdapterError> {
  switch (type) {
    case "View":
      return toHostNode(document.createElement("div"));
    case "Text":
      return toHostNode(document.createElement("span"));
    case "Button":
      return toHostNode(document.createElement("button"));
    case "Input":
      return toHostNode(document.createElement("input"));
    case "Image":
      return toHostNode(document.createElement("img"));
    case "ScrollView": {
      const element = document.createElement("div");
      element.style.overflow = "auto";
      return toHostNode(element);
    }
  }
}

function toHostNode(node: Node): Result<HostNode, HostAdapterError> {
  return {
    ok: true,
    value: node as unknown as HostNode,
    error: null
  };
}

function toDomNode(
  node: HostNode | HostRoot,
  method: string
): Result<Node, HostAdapterError> {
  if (node instanceof Node) {
    return {
      ok: true,
      value: node,
      error: null
    };
  }

  return err({
    code: "INVALID_HOST_NODE",
    message: `WebHostAdapter.${method}() expected a DOM Node-compatible host reference.`
  });
}
