# 工程与工具链规范

## 目标

这份文档定义 `jue` 的工程组织和工具链选择。

目标不是把工具堆满，而是把每个工具的职责切清楚：

- 谁负责类型检查
- 谁负责库构建
- 谁负责示例开发
- 谁负责测试
- 谁负责脚本执行
- 谁负责代码纪律

如果这些职责不切清楚，后面很容易出现：

- `vite` 和 `esbuild` 重叠
- `tsx` 被滥用成构建器
- examples 反向污染主包结构

## 工具链结论

当前建议采用：

- `TypeScript`
- `pnpm workspace`
- `tsc`
- `esbuild`
- `vite`
- `vitest`
- `eslint`
- `tsx`

全部源码使用 TypeScript 编写。

## 总体原则

1. 全仓库统一用 TypeScript。
2. `tsc` 只负责类型检查，不负责主构建。
3. `esbuild` 负责库包构建。
4. `vite` 只负责 examples / playground / web 调试层。
5. `vitest` 负责测试。
6. `tsx` 只负责运行脚本，不负责正式打包。
7. `eslint` 负责边界纪律和实现规范。

## 包管理与工作区

### 选择

使用 `pnpm workspace`。

原因：

- monorepo 支持稳定
- 适合多包共享依赖
- 安装和链接速度好
- 对 examples 和 packages 的隔离比较清楚

### 目录建议

```text
packages/
  shared/
  runtime-core/
  compiler/
  web/
  native/        # 先预留

examples/
  web-playground/
  bench/

scripts/
docs/
```

说明：

- `packages/` 放框架本体
- `examples/` 放示例和调试入口
- `scripts/` 放构建、代码生成、bench 等脚本

## TypeScript

### 原则

全仓库统一使用 TS。

适用范围：

- `packages/kernel/shared`
- `packages/kernel/runtime-core`
- `packages/kernel/compiler`
- `packages/host/web`
- `examples/*`
- `scripts/*`

### 配置原则

要求：

- `strict: true`
- `noImplicitOverride: true`
- `noImplicitThis: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`

说明：

- `exactOptionalPropertyTypes` 对 runtime 结构定义有价值
- `noUncheckedIndexedAccess` 对 slot / array 访问更安全

### `tsc` 职责

`tsc` 只负责：

- 类型检查
- 类型声明输出

不负责：

- 主 JS 构建
- examples dev server

## esbuild

### 职责

`esbuild` 负责库包构建。

适用范围：

- `packages/kernel/shared`
- `packages/kernel/runtime-core`
- `packages/kernel/compiler`
- `packages/host/web`

### 原因

- 构建快
- 适合库包产出
- 对纯 TS 库足够
- 不需要把 Web dev server 语义带进主构建

### 不负责

- 不负责 examples 开发
- 不负责最终规范定义
- 不负责类型检查

## Vite

### 职责

`vite` 只用于：

- `packages/examples/web-playground`
- 浏览器调试入口
- Web 侧 demo 和 playground

### 原因

- dev server 体验好
- HMR 好用
- 适合调试宿主适配层

### 硬约束

`vite` 不能主导主仓库结构。

具体表现：

- `packages/*` 不能为了迎合 Vite 改架构
- core/runtime/compiler 不能依赖 Vite 语义
- Vite 只是一层 Web 开发体验工具

## Vitest

### 职责

`vitest` 负责：

- 单元测试
- 部分集成测试
- Web adapter 的基础宿主测试

### 测试分层

优先划分成三类：

1. runtime 单元测试
2. compiler 输出测试
3. adapter 集成测试

### 运行环境

建议：

- 默认 `node`
- Web adapter 测试按需启用 `jsdom`

原因：

- 大部分核心逻辑不应该依赖 DOM
- 只有 `packages/host/web` 才需要 DOM 环境

## ESLint

### 职责

`eslint` 负责：

- 代码风格底线
- 架构边界纪律
- 禁止写法检查

### 应重点检查

- 禁止 `any`
- 禁止 `this`
- 禁止未使用变量
- 禁止隐式依赖收集入口
- 禁止 adapter 引用 runtime 私有实现
- 禁止 runtime 直接引用宿主包
- 禁止作者代码和 public authoring API 显式写 `undefined`

### 原则

lint 不只是格式工具。

这里更重要的是做“边界保护器”。

## tsx

### 职责

`tsx` 只用于运行脚本。

适用范围：

- `scripts/*.ts`
- bench 脚本
- 代码生成脚本
- 文档验证脚本

### 不允许

不把 `tsx` 当成：

- 正式构建器
- 库发布流程主入口
- examples 的长期运行依赖

## 产物策略

### 库包

每个库包建议产出：

- `dist/*.js`
- `dist/*.d.ts`
- source map

### examples

examples 不做发布产物承诺。

它们只用于：

- 调试
- 演示
- benchmark

## 包职责建议

### `packages/kernel/shared`

内容：

- 类型
- 枚举
- 常量
- 断言

构建：

- `esbuild + tsc`

### `packages/kernel/runtime-core`

内容：

- scheduler
- region
- resource
- binding dispatch

构建：

- `esbuild + tsc`

### `packages/kernel/compiler`

内容：

- TSX 解析
- blueprint 生成
- slot graph 输出

构建：

- `esbuild + tsc`

### `packages/host/web`

内容：

- host adapter
- Web 原语映射
- Web 事件桥接

构建：

- `esbuild + tsc`

### `packages/examples/web-playground`

内容：

- API 试验
- 宿主适配调试
- playground 页面

工具：

- `vite`

### `examples/bench`

内容：

- benchmark 页面或脚本

工具：

- `vite` 或 `tsx`，看是否需要浏览器环境

## 命令建议

建议统一命令面：

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm dev`
- `pnpm bench`

语义：

- `typecheck` -> `tsc --noEmit`
- `build` -> 库包构建
- `test` -> `vitest`
- `lint` -> `eslint`
- `dev` -> example playground
- `bench` -> benchmark 入口

## 不要做的事

下面这些直接禁止：

1. 用 `vite build` 作为主库构建器
2. 用 `tsx` 代替正式构建流程
3. 让 examples 反向决定 packages 的目录结构
4. 在 `packages/kernel/runtime-core` 里引入 DOM 类型依赖
5. 在 `packages/host/web` 里实现 scheduler / reactivity 逻辑
6. 混用多套测试框架

## 实施顺序

建议按这个顺序落地：

1. `pnpm workspace`
2. TypeScript 基础配置
3. `eslint`
4. `vitest`
5. `esbuild` 库构建
6. `vite` example playground
7. `tsx` 脚本入口

原因：

- 先把类型和边界立起来
- 再补测试
- 最后补开发体验层

## 验证清单

工具链落地后至少确认：

1. `packages/*` 不依赖 Vite 语义
2. `tsc` 可以独立跑完整类型检查
3. `esbuild` 可以独立产出库包
4. `vitest` 可以在 node 环境跑 core 测试
5. `packages/host/web` 的测试可以在 `jsdom` 下跑
6. `tsx` 只出现在脚本入口，不出现在正式构建链路
