# jue-current-app

`jue` 框架的**当前主示例应用**。基于 Vite 构建，展示如何使用 `jue` 编写、编译和运行一个完整的 Web 应用。

## 开发流程

```bash
# 开发模式（先编译 jue 组件，再启动 Vite）
pnpm run dev

# 生产构建
pnpm run build

# 预览构建产物
pnpm run preview
```

## 编译步骤

`pnpm run compile` 会运行 `scripts/compile.ts`，将 `jue` 组件源码编译为可在浏览器中运行的 JavaScript 模块。

## 与框架包的关系

- 使用 `@jue/compiler` 编译组件源码
- 使用 `@jue/web` 将编译产物挂载到 DOM
- 使用 `@jue/jsx` 编写组件

> 这是一个 `private` 包，仅作为示例和开发参考，不发布到 npm。
