# `@jue/gesture`

## 目标

`@jue/gesture` 是 `jue` 官方 stdlib 里的手势语义层。

它解决的是：

- 原始 pointer / touch / scroll 输入怎么变成高层意图
- 这些意图怎么显式进入 scheduler
- 手势识别怎么不污染 kernel 和 host adapter

它不解决：

- 原始宿主事件接线
- layout 测量
- animation 曲线

## 为什么它不进 kernel

gesture 的识别规则都属于策略：

- threshold
- direction lock
- velocity
- swipe 判定
- conflict resolution

这些都不是 kernel 不变量。

kernel 只需要统一：

- lane
- region
- flush
- channel / resource / signal 入口

## 包含什么

- press / tap
- drag
- pan
- swipe
- scroll intent
- threshold / direction-lock / velocity
- cancellation
- gesture composition

## 不包含什么

- 原始 DOM touch/pointer 注册
- native recognizer API
- host event translation
- layout
- viewport
- animation
- router
- resource policy

## 和 `jue` 其他层的关系

### 与 kernel

gesture 不能绕过 kernel。

它应该把识别到的高层意图显式送回：

- signal
- channel
- region / block handoff

并继续遵守 lane。

### 与 host layer

host layer 负责：

- 原始输入归一化
- capture / passive / platform 差异

gesture 层负责：

- 在这些标准化输入之上识别更高层意图

### 与 tooling

tooling 可以：

- replay gesture sequence
- trace gesture -> lane -> flush
- bench 高频输入成本

但不能定义 gesture 语义。

## 最小 API 草案

建议先有：

- `createGesture(...)`
- `press(...)`
- `drag(...)`
- `pan(...)`
- `swipe(...)`
- `compose(...)`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：水平拖拽

```tsx
import { View, Text } from "@jue/jsx"
import { drag } from "@jue/gesture"

export function Card() {
  const x = drag({ axis: "x", threshold: 8, lane: Lane.VISIBLE_UPDATE })

  return (
    <View style={{ transform: `translateX(${x.translationX.get()}px)` }}>
      <Text>Drag me</Text>
    </View>
  )
}
```

### 例 2：左滑删除

```tsx
import { View, Text } from "@jue/jsx"
import { swipe } from "@jue/gesture"

export function DismissRow() {
  const dismiss = swipe({ direction: "left", velocity: 1200, lane: Lane.SYNC_INPUT })

  return (
    <View style={{ opacity: dismiss.progress.get() }}>
      <Text>Swipe to dismiss</Text>
    </View>
  )
}
```

### 例 3：手势结果转 channel

```ts
const cardDragged = channel<{ id: string; deltaX: number }>("cardDragged")

drag({ axis: "x", lane: Lane.VISIBLE_UPDATE }).subscribe(event => {
  publish(cardDragged, {
    id: cardId,
    deltaX: event.translationX
  }, { lane: Lane.VISIBLE_UPDATE })
})
```

## 明确边界

`@jue/gesture` 不该偷偷长成：

- host input runtime
- viewport system
- animation system

它应该只负责“把原始输入整理成可消费的手势语义”。

## 实现时机判断

- 所属层：Official Standard Library
- 当前时机：后续扩面
- 优先级：中低

推进前提：

- host 输入归一化边界稳定
- scheduler 对高频输入的处理足够清楚
- 不会逼迫 kernel 接入 host-specific 输入细节
