# `@jue/animation`

## 目标

`@jue/animation` 是 `jue` 官方 stdlib 里的动效与过渡层。

它解决的是：

- 视觉时间轴怎么和 scheduler / lane 对齐
- region enter / leave 怎么有一层统一的动效策略
- 值插值怎么继续保持显式边界

它不解决：

- kernel region 语义
- 宿主动画 API 本体
- 布局测量

## 为什么它不进 kernel

animation 的这些东西都不是不变量：

- tween 还是 spring
- ease 还是 sequence
- enter / leave 还是 presence
- reduce motion 策略

这些都是策略层。

kernel 只需要统一：

- region
- lane
- version
- flush

## 包含什么

- transition controller
- presence / enter / leave orchestration
- tween
- spring
- sequence / stagger
- cancellation
- motion completion bookkeeping
- reduced-motion hook

## 不包含什么

- region state machine 本体
- slot 分配
- scheduler policy 本体
- DOM / native animation API
- CSS parser
- `requestAnimationFrame` 所有权
- layout 测量
- gesture
- router / query / form 语义

## 和 `jue` 其他层的关系

### 与 kernel

animation 只能消费 kernel，不应定义 kernel。

它应建立在：

- signal
- region
- lane
- version

之上，把动效更新显式送回已有路径。

### 与 host layer

host 可以提供：

- frame tick
- visibility hint
- reduced-motion preference

但 animation 不该把 host-specific 技巧写回主规范。

### 与 tooling

tooling 可以：

- inspect timeline
- trace cancellation
- bench transition cost

但不能决定 animation 运行时语义。

## 最小 API 草案

建议先有：

- `Transition`
- `Presence`
- `animate(...)`
- `tween(...)`
- `spring(...)`
- `sequence(...)`
- `stagger(...)`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：region enter / leave

```tsx
import { signal, View, Text } from "@jue/jsx"
import { Transition } from "@jue/animation"

export function Panel() {
  const open = signal(true)

  return (
    <Transition
      when={open.get()}
      enter={{ duration: 180, easing: "ease-out", lane: Lane.VISIBLE_UPDATE }}
      leave={{ duration: 120, easing: "ease-in", lane: Lane.VISIBLE_UPDATE }}
    >
      <View>
        <Text>Panel</Text>
      </View>
    </Transition>
  )
}
```

### 例 2：值插值

```tsx
import { signal, View } from "@jue/jsx"
import { animate } from "@jue/animation"

export function FadeBadge() {
  const visible = signal(true)
  const opacity = animate({
    when: visible.get(),
    from: 0,
    to: 1,
    duration: 150,
    lane: Lane.VISIBLE_UPDATE
  })

  return <View style={{ opacity: opacity.get() }} />
}
```

### 例 3：顺序动效

```ts
sequence([
  tween({ from: 0, to: 1, duration: 120 }),
  tween({ from: 1, to: 0.96, duration: 80 })
], { lane: Lane.DEFERRED })
```

## 明确边界

`@jue/animation` 不该偷偷长成：

- host animation engine
- layout engine
- gesture system

它应该只负责“动效策略与时间组合”，不负责“宿主如何执行所有动画”。

## 实现时机判断

- 所属层：Official Standard Library
- 当前时机：后续扩面
- 优先级：中

推进前提：

- scheduler 稳定
- region 稳定
- host bridge 对 frame / visibility 等能力有清楚边界
