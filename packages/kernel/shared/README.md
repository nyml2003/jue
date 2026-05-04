# @jue/shared

整个 `jue` 框架最底层的共享类型与常量。所有上层包（runtime-core、compiler、host 等）都依赖它，但它本身**不依赖任何其他 `@jue/*` 包**。

## 职责

- 定义跨平台的 **Host Primitive** 类型（`View`、`Text`、`Button` 等）
- 定义编译器与运行时共享的 **操作码、枚举常量**（绑定类型、区域类型、调度车道、资源状态等）
- 提供全栈统一使用的 **Result<T, E>** 类型及其辅助构造器

## 导出内容

### Host 原语 (`host.ts`)

```ts
export type HostPrimitive = "View" | "Text" | "Button" | "Input" | "Image" | "ScrollView";
export type HostEventKey = "onPress" | "onInput" | "onFocus" | "onBlur" | "onScroll";
```

这些常量限定了框架支持的跨平台 UI 原子节点类型与事件类型。

### 操作码与枚举 (`opcode.ts`)

| 枚举 | 用途 |
|------|------|
| `BindingOpcode` | 编译器生成的绑定指令类型：TEXT、PROP、STYLE、EVENT、REGION_SWITCH、KEYED_LIST、CHANNEL_DISPATCH、RESOURCE_COMMIT 等 |
| `RegionType` | 动态区域类型：CONDITIONAL、KEYED_LIST、NESTED_BLOCK、VIRTUAL_LIST |
| `RegionLifecycle` | 区域生命周期状态：UNINITIALIZED → INACTIVE → ACTIVE → UPDATING → DISPOSING → DISPOSED |
| `Lane` | 调度优先级车道：SYNC_INPUT、VISIBLE_UPDATE、DEFERRED、BACKGROUND |
| `ResourceStatus` | 异步资源状态：IDLE、PENDING、READY、ERROR |

### Result 类型 (`result.ts`)

全栈统一使用的显式错误处理类型：

```ts
export type Result<T, E> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E };

export function ok<T>(value: T): Result<T, never>;
export function err<E>(error: E): Result<never, E>;
```

运行时与编译器均通过 `Result` 传递成功/失败结果，避免抛异常。

## 设计原则

- **零依赖**：不引用任何其他 workspace 包，保证可被任意包安全引入。
- **纯类型 + 常量**：不包含任何运行时逻辑或副作用，bundle 体积极小。
