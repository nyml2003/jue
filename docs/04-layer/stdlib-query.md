# `@jue/query`

## 目标

`@jue/query` 是 `jue` 官方 stdlib 里的缓存型异步读取层。

它解决的是：

- 常见 query 场景怎么建立在 `resource` 之上
- key、cache、stale、retry、preload 怎么组织
- 这些策略怎么继续遵守 lane 和 version 规则

它不解决：

- transport client
- route convention
- UI 组件层

## 为什么它不进 kernel

kernel 需要统一的是：

- `resource`
- lane
- version
- scheduler

query 的这些东西都属于策略：

- cache key
- staleTime
- retry
- preload
- invalidation

所以 query 该是 stdlib，而不是 kernel。

## 包含什么

- query key 规范
- cache entry 状态
- stale / retry / preload 策略
- 显式失效
- `resource` 读模型封装
- lane-aware 提交

## 不包含什么

- transport client
- DOM / host 逻辑
- router 语义
- app store
- 隐式依赖收集
- scheduler 实现本体
- version 判定规则本体

## 和 `jue` 其他层的关系

### 与 kernel

query 必须建立在这些原语之上：

- `resource`
- `channel`
- `lane`
- `Result`

查询结果仍然必须：

- 进入 scheduler
- 遵守 version 丢弃规则
- 不直接写宿主

### 与 host layer

host 只负责展示 query 状态，不定义 query 语义。

### 与 tooling

tooling 可以：

- inspect cache entry
- trace invalidate / reload
- bench 缓存命中和刷新成本

但不能决定 query 运行时行为。

## 最小 API 草案

建议先有：

- `query(...)`
- `createQuery(...)`
- `query.value()`
- `query.status()`
- `query.error()`
- `query.reload()`
- `invalidateQuery(key, options?)`
- `preloadQuery(key, options?)`

## 使用例子

下面的例子是边界草案，不是当前仓库里已经存在的 API。

### 例 1：声明一个 query

```ts
import { Lane } from "jue"

const userQuery = query({
  key: ["user", userId],
  lane: Lane.VISIBLE_UPDATE,
  load: async ([, id]) => fetchUser(id),
  staleTime: 30_000
})

const user = userQuery.value()
```

### 例 2：通过 channel 失效 query

```ts
import { Lane, channel, subscribe } from "jue"

const userChanged = channel<{ id: string }>("userChanged")

subscribe(userChanged, ({ id }) => {
  invalidateQuery(["user", id], { lane: Lane.VISIBLE_UPDATE })
})
```

### 例 3：进入可见区前预取

```ts
import { Lane } from "jue"

preloadQuery(["todos", filter], { lane: Lane.DEFERRED })

const todosQuery = query({
  key: ["todos", filter],
  lane: Lane.VISIBLE_UPDATE,
  load: async ([, currentFilter]) => fetchTodos(currentFilter)
})
```

## 明确边界

`@jue/query` 不应该偷偷长成：

- 全局 store
- transport SDK
- app framework data layer

如果某个产品需要这些，它应该建立在 query 之上，而不是塞回 query 内核。

## 实现时机判断

- 所属层：Official Standard Library
- 当前时机：主线路径能力
- 优先级：中高

推进前提：

- `resource` 边界稳定
- lane / version 规则明确
- channel 与 invalidation 协同模型清楚
