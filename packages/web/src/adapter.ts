import type {
  HostAdapter,
  HostAdapterError,
  HostEventHandler,
  HostNode,
  HostRoot
} from "@jue/runtime-core";
import { err, type Result, type HostEventKey, type HostPrimitive, type HostPropKey, type HostStyleKey } from "@jue/shared";

export class WebHostAdapter implements HostAdapter {
  readonly #eventListeners = new WeakMap<Node, Map<HostEventKey, EventListener>>();

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
    const nodeResult = toDomNode(_node, "setProp.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    if (!(nodeResult.value instanceof Element)) {
      return err({
        code: "INVALID_PROP_TARGET",
        message: "WebHostAdapter.setProp() expected an Element-compatible host node."
      });
    }

    if (_value === null || _value === undefined || _value === false) {
      nodeResult.value.removeAttribute(_prop);

      if (_prop in nodeResult.value) {
        Reflect.set(nodeResult.value, _prop, _prop === "value" ? "" : null);
      }

      return { ok: true, value: undefined, error: null };
    }

    if (_prop in nodeResult.value) {
      Reflect.set(nodeResult.value, _prop, _value);
    } else {
      nodeResult.value.setAttribute(_prop, stringifyHostValue(_value));
    }

    return { ok: true, value: undefined, error: null };
  }

  setStyle(_node: HostNode, _styleKey: HostStyleKey, _value: unknown): Result<void, HostAdapterError> {
    const nodeResult = toDomNode(_node, "setStyle.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    if (!(nodeResult.value instanceof HTMLElement)) {
      return err({
        code: "INVALID_STYLE_TARGET",
        message: "WebHostAdapter.setStyle() expected an HTMLElement-compatible host node."
      });
    }

    if (_value === null || _value === undefined || _value === false) {
      nodeResult.value.style.removeProperty(toCssPropertyName(_styleKey));
      return { ok: true, value: undefined, error: null };
    }

    const styleValue = stringifyHostValue(_value);
    nodeResult.value.style.setProperty(toCssPropertyName(_styleKey), styleValue);
    return { ok: true, value: undefined, error: null };
  }

  setEvent(
    _node: HostNode,
    _eventKey: HostEventKey,
    _handler: HostEventHandler | null
  ): Result<void, HostAdapterError> {
    const nodeResult = toDomNode(_node, "setEvent.node");
    if (!nodeResult.ok) {
      return nodeResult;
    }

    const eventName = toDomEventName(_eventKey);
    if (eventName === null) {
      return err({
        code: "UNSUPPORTED_EVENT_KEY",
        message: `WebHostAdapter.setEvent() does not support event key ${_eventKey}.`
      });
    }

    const listenerMap = getOrCreateListenerMap(this.#eventListeners, nodeResult.value);
    const previousListener = listenerMap.get(_eventKey);

    if (previousListener) {
      nodeResult.value.removeEventListener(eventName, previousListener);
      listenerMap.delete(_eventKey);
    }

    if (_handler === null) {
      return { ok: true, value: undefined, error: null };
    }

    const nextListener: EventListener = nativeEvent => {
      _handler(normalizeHostEvent(nativeEvent));
    };

    listenerMap.set(_eventKey, nextListener);
    nodeResult.value.addEventListener(eventName, nextListener);
    return { ok: true, value: undefined, error: null };
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

function toCssPropertyName(styleKey: HostStyleKey): string {
  return styleKey.startsWith("--")
    ? styleKey
    : styleKey.replaceAll(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function stringifyHostValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.description ?? "";
  }

  return Object.prototype.toString.call(value);
}

function toDomEventName(eventKey: HostEventKey): string | null {
  switch (eventKey) {
    case "onPress":
      return "click";
    case "onInput":
      return "input";
    case "onFocus":
      return "focus";
    case "onBlur":
      return "blur";
    case "onScroll":
      return "scroll";
    default:
      return null;
  }
}

function getOrCreateListenerMap(
  eventListeners: WeakMap<Node, Map<HostEventKey, EventListener>>,
  node: Node
): Map<HostEventKey, EventListener> {
  const existing = eventListeners.get(node);
  if (existing) {
    return existing;
  }

  const created = new Map<HostEventKey, EventListener>();
  eventListeners.set(node, created);
  return created;
}

function normalizeHostEvent(nativeEvent: Event) {
  const currentTarget = nativeEvent.currentTarget;
  const target = nativeEvent.target;
  const value = currentTarget instanceof HTMLInputElement || currentTarget instanceof HTMLTextAreaElement
    ? currentTarget.value
    : undefined;

  return {
    type: nativeEvent.type,
    target,
    currentTarget,
    value,
    nativeEvent
  };
}
