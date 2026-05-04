# @jue/devtrace

`jue` 框架的**开发追踪与调试工具**。在开发和测试阶段收集框架内部事件（信号写入、通道发布、资源加载、导航、区域生命周期等），帮助开发者理解运行时行为。

## 职责

- **事件收集**：记录框架内部各类事件，带时间戳和上下文详情
- **格式化输出**：将事件序列化为可读的时间线文本
- **多场景覆盖**：支持信号、通道、资源、导航、调度车道、脏标记、刷新、区域生命周期、文档生成等事件类型

## API

### 创建收集器

```ts
import { createDevTraceCollector } from "@jue/devtrace";

const trace = createDevTraceCollector();
```

### 记录事件

```ts
trace.record({
  kind: "signal-write",
  lane: Lane.VISIBLE_UPDATE,
  message: "count updated",
  detail: { slot: 0, value: 42 }
});
```

### 读取与格式化

```ts
trace.read();     // DevTraceEvent[]
trace.format();   // 格式化文本，如 "[2024-01-01T00:00:00Z] signal-write lane=1: count updated"
trace.clear();    // 清空
```

### 快捷追踪函数

针对框架各子系统提供预置的追踪函数：

```ts
import {
  traceSignalWrite,
  traceChannelPublish,
  traceResourceEvent,
  traceNavigation,
  traceLaneSchedule,
  traceDirtyMark,
  traceFlush,
  traceRegionLifecycle,
  traceDocsGeneration
} from "@jue/devtrace";

traceSignalWrite(trace, 0, Lane.VISIBLE_UPDATE, 42);
traceResourceEvent(trace, 0, Lane.VISIBLE_UPDATE, "ready");
traceNavigation(trace, "/users/42");
traceFlush(trace, Lane.VISIBLE_UPDATE, 5);
traceRegionLifecycle(trace, 1, "conditional", "switch");
```

## 事件类型

| kind | 说明 | 典型来源 |
|------|------|----------|
| `signal-write` | 信号写入 | `@jue/runtime-core` signal-state |
| `channel-publish` | 通道发布 | `@jue/runtime-core` channel |
| `resource` | 资源状态变化 | `@jue/runtime-core` resource-state、@jue/query |
| `navigation` | 路由导航 | `@jue/router` |
| `lane` | 调度队列入队 | `@jue/runtime-core` scheduler-state |
| `dirty` | 脏标记 | `@jue/runtime-core` dirty-bits |
| `flush` | 绑定刷新 | `@jue/runtime-core` flush-bindings |
| `region` | 区域生命周期 | `@jue/runtime-core` block-instance |
| `docsgen` | 文档生成 | `@jue/docsgen` |

## 使用场景

### 测试断言

```ts
const trace = createDevTraceCollector();
// ... 执行被测代码，传入 trace ...

const events = trace.read();
assert.equal(events[0].kind, "signal-write");
assert.equal(events[1].kind, "flush");
```

### 调试日志

```ts
const trace = createDevTraceCollector();

// 运行复杂交互
userQuery.reload();
router.navigate("/about");

console.log(trace.format());
```

## 与相关包的关系

- `@jue/shared`：使用 `Lane` 类型
- 被 `@jue/runtime-core`、`@jue/query`、`@jue/router`、`@jue/docsgen` 等包可选依赖
