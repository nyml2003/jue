# @jue/router

`jue` 框架的**路由管理库**。提供与平台无关的路由状态管理，支持浏览器历史（`pushState`/`replaceState`）和内存历史两种模式。

## 职责

- **路由状态管理**：追踪当前 URL（pathname + query），支持订阅变化
- **导航操作**：`navigate`、`replace`、`back`
- **路由匹配**：支持路径参数（如 `/users/:id`）和查询字符串解析
- **路由分发**：`createRouteHandoff` 自动将匹配的路由分发给对应的处理函数
- **开发追踪**：集成 `@jue/devtrace`，可追踪导航事件

## API

### 创建路由器

```ts
import { createRouter, createBrowserHistoryBridge } from "@jue/router";

// 浏览器模式（使用 pushState/replaceState）
const router = createRouter();

// 或显式指定历史桥接
const router = createRouter({
  history: createBrowserHistoryBridge(),
  trace: devTraceCollector
});
```

### 内存历史模式

适用于测试、小程序或非浏览器环境：

```ts
import { createRouter, createHistoryBridge } from "@jue/router";

const router = createRouter({
  history: createHistoryBridge("/initial/path")
});
```

### 读取路由状态

```ts
router.state();   // { href: "/users/42?tab=profile", pathname: "/users/42", query: { tab: "profile" } }
router.query();   // { tab: "profile" }

const match = router.match("/users/:id");
// { matched: true, params: { id: "42" } }
```

### 导航

```ts
router.navigate("/users/42");
router.replace("/users/42?tab=settings");
router.back();
```

### 订阅变化

```ts
const unsub = router.subscribe((state) => {
  console.log("Navigated to", state.href);
});

// 取消订阅
unsub.unsubscribe();
```

### 路由分发

自动根据路由模式匹配并调用对应的 enter 回调：

```ts
import { createRouteHandoff } from "@jue/router";

const unsub = createRouteHandoff(router, [
  {
    pattern: "/",
    enter: ({ state, match }) => showHomePage()
  },
  {
    pattern: "/users/:id",
    enter: ({ state, match }) => showUserPage(match.params.id)
  },
  {
    pattern: "/about",
    enter: ({ state, match }) => showAboutPage()
  }
]);
```

## HistoryBridge

`HistoryBridge` 是路由器的底层抽象，负责管理历史栈和订阅：

| 方法 | 说明 |
|------|------|
| `current()` | 获取当前 URL |
| `navigate(href)` | 压入新历史记录 |
| `replace(href)` | 替换当前历史记录 |
| `back()` | 回退 |
| `subscribe(listener)` | 订阅变化 |

## 与相关包的关系

- `@jue/shared`：使用 `Result` 类型
- `@jue/devtrace`（可选）：传入 `DevTraceCollector` 可追踪导航事件
