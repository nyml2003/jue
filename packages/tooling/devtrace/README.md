# `@jue/devtrace`

开发追踪工具。提供运行时事件收集器，用于开发期诊断 signal-write、channel-publish、resource、flush、region lifecycle 等运行时行为。

## 使用

```ts
import { createDevTraceCollector } from "@jue/devtrace"

const trace = createDevTraceCollector()
```
