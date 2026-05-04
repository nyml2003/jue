# jue-mobile-showcase

`jue` 框架的**移动端展示应用**。同时支持浏览器（Web）和微信小程序（Skyline）两种目标平台，演示同一套组件源码如何编译到不同宿主环境。

## 开发流程

### Web 端

```bash
# 编译 Web 版本并启动开发服务器
pnpm run dev:web

# 编译并构建 Web 版本
pnpm run build:web
```

### 小程序端

```bash
# 编译小程序版本（依赖 @jue/skyline）
pnpm run compile:mp
```

`compile:mp` 会先确保 `@jue/skyline` 已构建，然后运行 `scripts/generate-miniprogram.ts`，将组件源码编译为 Skyline 引擎可消费的 `SkylineArtifact`。

### 同时编译

```bash
# 编译 Web + 小程序
pnpm run compile
```

## 类型检查

```bash
# 检查源码类型
pnpm run typecheck

# 检查生成代码类型
pnpm run lint:generated
```

## 与框架包的关系

- 浏览器端使用 `@jue/web` 挂载
- 小程序端使用 `@jue/skyline` 编译
- 共享 `@jue/compiler` 编译组件源码

> 这是一个 `private` 包，仅作为跨平台示例参考，不发布到 npm。
