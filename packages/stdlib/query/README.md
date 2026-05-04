# @jue/query

`jue` 框架的**异步数据查询客户端**。基于 `@jue/runtime-core` 的 `ResourceState` 构建，提供带缓存、失效、预加载和过时检测的数据获取能力。

灵感来自 TanStack Query（React Query），但专为 `jue` 的信号系统和 Lane 调度设计。

## 职责

- **查询管理**：通过 `key` 唯一标识查询，自动复用相同 key 的实例
- **异步资源状态**：内部使用 `ResourceState` 管理 `idle → pending → ready/error` 生命周期
- **缓存与过时检测**：支持 `staleTime`，超过阈值自动标记为 stale，下次访问时重新加载
- **Lane 调度**：数据加载按 `Lane.VISIBLE_UPDATE`（可配置）调度，避免阻塞同步输入
- **开发追踪**：集成 `@jue/devtrace`，可追踪每次查询的 pending/ready/error 事件

## API

### 创建查询客户端

```ts
import { createQueryClient } from "@jue/query";

const client = createQueryClient({ trace: devTraceCollector });
```

### 创建查询

```ts
const userQuery = client.createQuery({
  key: ["user", userId],
  load: async (key) => {
    const response = await fetch(`/api/users/${key[1]}`);
    return response.json();
  },
  lane: Lane.VISIBLE_UPDATE,  // 可选，默认 VISIBLE_UPDATE
  staleTime: 60_000           // 可选，默认 0（始终 stale）
});
```

### 使用查询句柄

```ts
userQuery.status();   // ResourceStatus: IDLE | PENDING | READY | ERROR
userQuery.value();    // T | null
userQuery.error();    // unknown
userQuery.isStale();  // boolean

// 手动重新加载
await userQuery.reload();

// 预加载（不阻塞当前 UI）
await userQuery.preload();

// 标记为过时（下次访问时重新加载）
userQuery.invalidate();
```

### 快捷函数

```ts
import { createQuery, query } from "@jue/query";

// 等同于 client.createQuery
const q = createQuery(client, { key: ["items"], load: fetchItems });
```

### 客户端级操作

```ts
// 按 key 使查询失效
client.invalidateQuery(["user", userId]);

// 按 key 预加载（即使该查询尚未创建）
await client.preloadQuery(["user", userId]);
```

## 与相关包的关系

- `@jue/runtime-core`：使用 `ResourceState`、`beginResourceRequest`、`commitResourceValue` 等底层 API
- `@jue/shared`：使用 `Lane`、`ResourceStatus`、`Result` 等类型
- `@jue/devtrace`（可选）：传入 `DevTraceCollector` 可追踪查询生命周期事件
