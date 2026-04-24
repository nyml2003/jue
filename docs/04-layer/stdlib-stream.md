# `@jue/stream`

## 目标

`@jue/stream` 是 `jue` 官方 stdlib 里的时间数据流层。

它解决的是：

- 事件和异步序列怎么显式组合
- signal / channel / resource 怎么和“流”互相桥接
- 这些桥接怎么继续遵守 scheduler / lane / disposal 规则

它不解决：

- kernel 不变量
- 隐式依赖收集
- app framework 状态组织

## 为什么它不进 kernel

因为 stream 是策略层，不是不变量层。

kernel 只需要统一：

- signal
- region
- channel
- resource
- lane
- flush

但 stream 怎么组合、提供多少 operator、给哪些 source/sink 做桥接，都存在明显策略空间。

所以它应该属于官方 stdlib，而不是 kernel。

## 包含什么

- 显式 stream source
- 显式 subscription / teardown
- 与 `signal` 的桥接
- 与 `channel` 的桥接
- 与 `resource` 的桥接
- lane-aware emission
- disposal 协同
- 一小组不会破坏架构的 operator

## 不包含什么

- 隐式订阅
- effect 风格依赖收集
- 全局事件总线
- 直接 DOM patch
- 全局 store
- query/cache 策略
- router 语义
- host-specific 事件注册细节

## 和 `jue` 其他层的关系

### 与 kernel

`@jue/stream` 依赖 kernel，但不能定义 kernel。

它应该建立在这些原语之上：

- `signal`
- `channel`
- `resource`
- `lane`
- `Result`

并且所有下游提交都要继续走 scheduler。

### 与 host layer

host layer 负责：

- 原始事件接线
- 宿主对象桥接

stream 层只负责：

- 把这些输入整理成可组合的数据流

### 与 tooling

tooling 可以：

- inspect stream source/sink
- trace lane 与 flush
- bench operator 成本

但 tooling 不定义 stream 运行时语义。

## 最小 API 草案

当前更适合的第一版 API 是“桥接优先”，不是“操作符大全优先”。

建议先有：

- `createStream(...)`
- `fromSignal(signal, options?)`
- `fromChannel(channel, options?)`
- `toSignal(stream, target, options?)`
- `toChannel(stream, target, options?)`
- `toResource(stream, options?)`

然后再补一小组基础 operator：

- `map`
- `filter`
- `scan`
- `distinctUntilChanged`
- `merge`
- `takeUntil`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：从 signal 构造 stream，再回写 signal

```ts
import { createSignal } from "@jue/jsx"
import { fromSignal, toSignal } from "@jue/stream"

const count = createSignal(0)
const label = createSignal("Count: 0")

const count$ = fromSignal(count, { lane: "VISIBLE_UPDATE" })
const stop = toSignal(
  count$.map(value => `Count: ${value}`),
  label,
  { lane: "VISIBLE_UPDATE" }
)
```

### 例 2：从 channel 构造 stream

```ts
import { channel, subscribe } from "jue"
import { fromChannel } from "@jue/stream"

const saveDone = channel<{ ok: boolean; id: string }>("saveDone")
const saveDone$ = fromChannel(saveDone, { lane: "VISIBLE_UPDATE" })

const stop = saveDone$
  .filter(message => message.ok)
  .subscribe(message => {
    console.log("saved", message.id)
  })
```

### 例 3：把 stream 桥接到 resource

```ts
import { fromSignal, toResource } from "@jue/stream"

const userId$ = fromSignal(userId, { lane: "VISIBLE_UPDATE" })

const userResource = toResource(userId$, {
  lane: "VISIBLE_UPDATE",
  load: async id => fetchUser(id)
})
```

## 明确边界

下面这些写法不该成为 `@jue/stream` 的主路径：

```ts
stream.subscribe(value => {
  someSignal.set(value)
})
```

问题不是这段代码永远不能存在，而是它会默认绕过：

- lane 分类
- scheduler 入口
- disposal 语义

更合适的写法应该是显式桥接：

```ts
toSignal(stream, someSignal, { lane: "VISIBLE_UPDATE" })
```

## 阶段判断

- 所属层：Official Standard Library
- 阶段：Phase 2
- 优先级：高

它应该在这些东西稳定后推进：

- scheduler
- channel
- resource
- disposal

但它不应该抢在 kernel 主线之前。
