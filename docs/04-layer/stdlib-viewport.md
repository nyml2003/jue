# `@jue/viewport`

## 目标

`@jue/viewport` 是 `jue` 官方 stdlib 里的宿主观察与可见区状态层。

它解决的是：

- scroll / visibility / focus / resize / intersection 怎么变成统一观察结果
- 这些观察结果怎么进入 lane-aware 更新路径
- viewport 类能力怎么不污染 kernel 与 host contract

它不解决：

- layout engine
- router
- query
- form

## 为什么它不进 kernel

viewport 观察是策略层能力，不是不变量。

kernel 需要统一的是：

- lane
- region
- channel
- resource
- flush

但这些观察能力本身存在很多策略差异：

- 什么时候算 visible
- threshold 怎么设
- resize 怎么节流
- focus / blur 怎么表达

所以它应该属于官方 stdlib。

## 包含什么

- scroll viewport observation
- visibility helper
- focus helper
- resize helper
- intersection helper
- 标准化观察结果
- teardown / cleanup
- lane-aware notification

## 不包含什么

- kernel 规则
- 直接 DOM / native patch
- router / history
- cache / fetch
- form 语义
- layout engine
- 第二套状态管理

## 和 `jue` 其他层的关系

### 与 kernel

viewport 只能把观察结果显式送入现有 kernel 入口。

它不能定义：

- slot
- region
- channel
- resource version
- flush 顺序

### 与 host layer

host layer 负责：

- 真实测量
- 真实事件接线

viewport 层只负责：

- 把这些宿主能力整理成宿主无关的观察结果

### 与 tooling

tooling 可以：

- inspect viewport state
- trace scroll / resize / intersection
- bench 高频观察成本

但不能决定 viewport 语义。

## 最小 API 草案

建议先有：

- `observeViewport(...)`
- `observeVisibility(...)`
- `observeFocus(...)`
- `observeResize(...)`
- `observeIntersection(...)`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：观察 scroll viewport

```ts
import { observeViewport } from "@jue/viewport"
import { channel, publish } from "jue"

const viewportChanged = channel<{
  scrollTop: number
  clientHeight: number
}>("viewportChanged")

const stop = observeViewport(scroller, { lane: "VISIBLE_UPDATE" }).subscribe(viewport => {
  publish(viewportChanged, {
    scrollTop: viewport.scrollTop,
    clientHeight: viewport.clientHeight
  }, { lane: "VISIBLE_UPDATE" })
})
```

### 例 2：进入可见区后预取

```ts
const stop = observeVisibility(panel, { lane: "DEFERRED" }).subscribe(state => {
  if (!state.visible) {
    return
  }

  queuePrefetch()
})
```

### 例 3：resize 影响 virtual list window

```ts
const stop = observeResize(host, { lane: "VISIBLE_UPDATE" }).subscribe(({ width, height }) => {
  updateVirtualListWindow(width, height)
})
```

## 明确边界

`@jue/viewport` 不应该偷偷长成：

- layout system
- router helper
- animation system

它应该只负责“观察”和“标准化结果”，不负责更高层策略。

## 阶段判断

- 所属层：Official Standard Library
- 阶段：Phase 3
- 优先级：中低

推进前提：

- host bridge 已经足够稳定
- virtual list / visible range 语义已经有明确使用方
- 高频观察能被合理分类到 `VISIBLE_UPDATE` 或 `DEFERRED`
