# @jue/web

`jue` 框架的 **Web 浏览器宿主适配器**。将 `@jue/runtime-core` 的平台无关操作翻译为实际的 DOM API，并提供组件挂载、信号更新和生命周期管理的高层 API。

## 职责

- **DOM 适配**：实现 `HostAdapter` 接口，把 `createNode`、`insert`、`setProp`、`setEvent` 等操作映射到 `document.createElement`、`appendChild`、`setAttribute`、`addEventListener`
- **组件挂载**：提供从 Blueprint 到真实 DOM 树的一键挂载
- **信号桥接**：将源码中的命名信号（如 `count`）映射到 runtime-core 的 signal slot，支持运行时读写
- **生命周期管理**：支持 `dispose()` 卸载组件，清理事件监听器

## 核心 API

### 挂载编译后的模块

最常用的高层 API，适合直接挂载 `@jue/compiler` 的输出：

```ts
import { mountCompiledModule } from "@jue/web";

const mounted = mountCompiledModule({
  root: document.getElementById("app")!,
  blueprint: compiled.blueprint,
  signalCount: compiled.signalCount,
  initialSignalValues: compiled.initialSignalValues,
  handlers: {
    onPress: () => console.log("pressed")
  }
});

if (mounted.ok) {
  // 通过 signal runtime bridge 更新状态
  mounted.value.mountedTree.signalRuntime.write("count", 42);
}
```

### 挂载单个 Block

低层 API，适合需要精细控制节点创建的场景：

```ts
import { mountBlock } from "@jue/web";

const mounted = mountBlock({
  blueprint: myBlueprint,
  signalCount: 4,
  createNode: () => ok(toHostNode(document.createElement("div"))),
  root: document.getElementById("app")!
});

if (mounted.ok) {
  mounted.value.setSignal(0, "new text");
  mounted.value.dispose();
}
```

### 挂载树

```ts
import { mountTree } from "@jue/web";

const mounted = mountTree({
  blueprint: myBlueprint,
  root: document.getElementById("app")!,
  signalCount: 4
});
```

## WebHostAdapter

`WebHostAdapter` 实现了 `@jue/runtime-core` 的 `HostAdapter` 接口，内部使用 `WeakMap` 管理事件监听器，确保 `dispose()` 时能正确清理：

| runtime-core 操作 | DOM 实现 |
|-------------------|----------|
| `createNode` | `document.createElement(tag)` |
| `createText` | `document.createTextNode(value)` |
| `insert` | `parent.insertBefore(node, anchor)` / `appendChild` |
| `remove` | `parent.removeChild(node)` |
| `setText` | `textNode.data = value` |
| `setProp` | `element.setAttribute(key, value)` / 直接属性赋值 |
| `setStyle` | `element.style.setProperty(key, value)` |
| `setEvent` | `addEventListener` / `removeEventListener` |

## 与相关包的关系

- `@jue/runtime-core`：提供 BlockInstance、Blueprint、HostAdapter 等抽象
- `@jue/compiler`：输出 Blueprint 供本包挂载
