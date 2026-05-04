# @jue/web-playground

`jue` 框架的 **Web Playground**。包含一组可交互的示例应用，用于演示框架各特性的实际效果，并作为 E2E 测试的目标环境。

## 示例应用

示例应用位于 `apps/` 目录下，每个应用包含：

- `page.component.tsx` —— `jue` 组件源码
- `page.ts` —— 运行时入口
- `page.test.ts` —— 单元测试
- `page.error.test.ts` —— 错误场景测试
- `e2e/page.spec.ts` —— Playwright E2E 测试

## 开发流程

```bash
# 构建所有示例应用（编译组件 + Vite 构建）
pnpm run build

# 构建并启动预览服务器
pnpm run preview

# E2E 测试（先构建，再运行 Playwright）
pnpm run test:e2e
```

## 构建说明

`pnpm run build` 执行两步：

1. `compile-example-components.ts` —— 编译所有 `apps/*/*.component.tsx` 为可运行模块
2. `build-example-apps.ts` —— 使用 Vite 构建每个示例应用为独立的静态站点

## 与框架包的关系

- 使用 `@jue/web` 在浏览器中挂载组件
- 使用 `@jue/shared` 的基础类型
- 使用 `@jue/compiler` 编译组件源码

> 这是一个 `private` 包，仅作为演示和测试环境，不发布到 npm。
