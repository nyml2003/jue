# `@jue/router`

## 目标

`@jue/router` 是 `jue` 官方 stdlib 里的导航状态层。

它解决的是：

- URL / history / params / query 怎么变成显式状态
- 路由变化怎么进入 scheduler
- route state 怎么交给 region / block 边界去消费

它不解决：

- app framework 目录约定
- 页面发现
- SSR framework
- 数据获取策略

## 为什么它不进 kernel

路由存在多种合理策略：

- history 模式
- hash 模式
- memory 模式
- route match 结构
- params / query 解析方式

这些都不是 kernel 不变量。

kernel 只需要保证：

- route 变化也能进入统一调度
- region / block 切换仍然遵守现有边界

## 包含什么

- route state
- history bridge
- params / query 解析与序列化
- 显式导航命令
- route match
- route -> region / block handoff

## 不包含什么

- file-based routing
- app shell
- 页面目录结构
- query/cache
- SSR / hydration
- layout system
- 页面级 convention

## 和 `jue` 其他层的关系

### 与 kernel

router 依赖：

- lane
- region 边界
- scheduler

但 router 不拥有：

- region state machine
- flush 顺序
- resource version 规则

### 与 host layer

host layer 可以提供：

- `window.history`
- `location`
- native navigation bridge

router 层只负责把这些宿主能力转换成宿主无关的 route state。

### 与 tooling

tooling 可以：

- trace 导航
- inspect route match
- bench 路由切换成本

但不能决定 router 语义。

## 最小 API 草案

建议先有：

- `createRouter(...)`
- `createHistoryBridge(...)`
- `navigate(...)`
- `replace(...)`
- `back()`
- `params()`
- `query()`
- `match(...)`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：创建 router

```ts
import { Lane } from "jue"
import { createRouter, createHistoryBridge } from "@jue/router"

const router = createRouter({
  history: createHistoryBridge(window.history, window.location),
  lane: Lane.VISIBLE_UPDATE
})
```

### 例 2：根据 route state 切换 region

```ts
const stop = router.route$.subscribe(route => {
  if (route.name === "user") {
    userPageRegion.show(route.params.id)
    return
  }

  homeRegion.show()
})
```

### 例 3：显式导航

```ts
router.navigate({
  name: "issue",
  params: { id: "42" },
  query: { tab: "activity" }
}, { lane: Lane.VISIBLE_UPDATE })
```

## 明确边界

`@jue/router` 不该偷偷长成：

- app framework
- layout framework
- SSR framework
- page discovery convention

如果后面要做这些，它们应该建立在 router 之上，而不是塞回 router。

## 实现时机判断

- 所属层：Official Standard Library
- 当前时机：主线路径能力
- 优先级：中高

推进前提：

- host history bridge 边界明确
- region / block handoff 模型稳定
- route 变化能被明确分类到合适 lane
