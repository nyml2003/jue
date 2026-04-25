# Phase 2：官方能力层补齐

`Phase 2` 正在重做验收。

这一阶段不是“随便补点上层糖”，而是补 `jue` 官方能力层里最值得做、但不该进入 kernel 的部分。

## 核心目标

1. 让 authoring 原语更完整
2. 让官方 stdlib 出现第一批真正可用的包
3. 让调试 / 文档 / authoring 体验进一步成形

## 包范围

- `@jue/primitives`
- `@jue/authoring-check`
- `@jue/stream`
- `@jue/router`
- `@jue/query`
- `@jue/devtrace`
- `@jue/docsgen`

## 为什么这些排在这里

因为它们都很重要，但都不属于 kernel：

- `primitives` 是 authoring 层
- `authoring-check` 是作者体验层
- `stream / router / query` 是 stdlib
- `devtrace / docsgen` 是 tooling

把这些放到 Phase 2，等于明确承认：

- 它们值得做
- 但它们不能抢在 kernel 闭环前定义整个世界

## 当前阶段重点

### 1. `@jue/primitives`

优先补：

- `Show`
- `List`
- `VirtualList`

并确保三端语义一致：

- frontend
- IR
- runtime

### 2. `@jue/stream`

定位明确成：

- scheduler-aware stream

而不是第二套隐式响应式系统。

优先做：

- `fromSignal`
- `fromChannel`
- `toSignal`
- `toChannel`
- `toResource`

### 3. `@jue/router`

定位明确成：

- 显式 route state + history bridge + route handoff

而不是 app framework。

### 4. `@jue/query`

定位明确成：

- `resource` 之上的 cache / stale / invalidation 层

而不是 transport SDK 或 app data layer。

### 5. `@jue/devtrace` / `@jue/docsgen`

让：

- trace
- docs
- examples

之间形成真正可复用的工程闭环。

## 退出条件

只有满足下面这些条件，才算准备进入 Phase 3：

1. 官方 stdlib 的第一批包已经有明确边界，不再和 kernel 争夺职责。
2. `Show / List / VirtualList` 已经不是零散 support 点，而是稳定 authoring primitive。
3. `stream / router / query` 已经形成最小可用标准库，而不是仅有概念草图。
4. `devtrace / docsgen` 已经能服务日常开发，而不只是纸面计划。

## 当前状态

上述退出条件还不能宣布满足。

新的验收线已经明确：

- 除调试/工具能力外，没有非调试、端到端、完备用例的能力，一律视为未支持。

这意味着：

- “有包 + 有测试 + 有 playground glue” 不再等于支持。
- 如果 example 还依赖业务级 `page.ts` glue，说明 compiler 主路径还没过关。
- 当前主线不是宣布完成，而是把 `Phase 2` 从“包存在”推进到“真正支持”。
