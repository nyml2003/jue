# 当前现状

更新时间：2026-04-22

这份文档只整理仓库当前事实，方便后续同步文档和继续改代码。

## 仓库状态

- 当前分支：`master`
- 当前工作区：干净，无未提交改动
- 最近提交：
  - `e498590` `feat: 支持tsx`
  - `c0ae7c4` `feat: 虚拟列表例子`
  - `78d333f` `feat：VIRTUAL_LIST`
  - `977dff5` `feat: Region 状态机`

## 现在已经落地的能力

### 运行时与 IR 主链

- `BlockIR -> lowering -> Blueprint -> runtime` 主链已经成立
- `packages/compiler/src/block-ir.ts` 已覆盖节点、binding 和 region lowering
- `packages/compiler/src/blueprint-builder.ts` 已是主要的声明式 authoring 入口
- `packages/runtime-core`、`packages/web`、`packages/shared` 的基础测试都在

### Region 能力

- `CONDITIONAL` 已有真实 branch attach / switch / clear
- `NESTED_BLOCK` 已有 attach / replace / detach
- `KEYED_LIST` 已有最小正确性优先 reconcile
- `VIRTUAL_LIST` 已有最小 window state 和 web controller
- `examples/web-playground/src/tab-panel.ts` 已接入 `VIRTUAL_LIST` 示例

### Compiler Frontend

- `packages/compiler/src/index.ts` 不再提供真正的 `compile()`，这里只返回 `COMPILE_MOVED`
- 真正的前端入口已经移动到 `@jue/compiler/frontend`
- `packages/compiler/src/frontend/index.ts` 已支持：
  - 单根 JSX Element
  - 静态 element / text
  - `{identifier}` 文本绑定
  - 简单 prop 绑定
  - 直接命名函数 event handler
  - 极小 conditional：`cond ? <A /> : <B />`
- `packages/compiler/src/frontend/compile-module.ts` 已能把 `.component.tsx` 编译成可执行模块
- `scripts/compile-example-components.ts` 已会批量生成 `examples/web-playground/src/*.generated.ts`

### Playground / Canary

- `examples/web-playground/src/compiler-canary.component.tsx` 已验证最小 TSX canary
- `examples/web-playground/src/operations-deck.component.tsx` 已验证更复杂的 TSX authored 页面
- 这两个例子都不是手写 Blueprint，而是先编译，再挂载到 runtime

## 已验证结果

2026-04-22 本地执行结果：

- `pnpm typecheck`：通过
- `pnpm test`：通过，`10` 个测试文件、`60` 个测试全部通过
- `pnpm build`：通过
- `pnpm lint`：失败

当前 lint 失败不是业务逻辑回归，而是 ESLint 配置问题：

- `scripts/report-package-sizes.mjs` 被命中了需要 type-aware parser services 的 `@typescript-eslint/await-thenable`
- 但这类 `.mjs` 文件没有对应的 typed lint parser 配置

这意味着当前仓库的真实状态更接近：

- 代码主链可用
- 构建可用
- 测试可用
- lint 配置还没收口

## 当前文档和代码的断层

### README 入口已对齐，但细节仍可继续补

`README.md` 现在已经改到和当前阶段一致，至少不会再把仓库描述成“文档先行阶段”。

后面仍然可以继续补的内容是：

- compiler frontend 的入口边界说明
- example 编译链路说明
- lint 现状和工程入口说明

### Compiler API 需要同步说明

当前需要在文档里明确：

- `@jue/compiler` 根入口保留的是后端与 builder 能力
- `compile()` 已迁到 `@jue/compiler/frontend`
- `compileModule()` 可用于把 `.component.tsx` 产物编译成可执行模块代码

### D2 进度需要重新表述

`docs/01-overview/roadmap.md` 已承认 D2 canary 开始了，但后续文档还需要更明确地区分：

- “完整 frontend 仍未完成”
- “最小 frontend canary 已落地，并已进入 example 使用”

## 继续推进前最值得做的事

### 文档侧

- README 主入口已经更新，后续重点转到细节同步
- 补 `docs/02-core-specs/compiler-strategy.md` 的入口说明，写清 `@jue/compiler` 与 `@jue/compiler/frontend` 的边界
- 补一段 example 说明，明确 `.component.tsx -> .generated.ts -> mount` 的链路
- 如果要对外讲路线，建议把当前主线写成：
  - 稳定 `D1 / E`
  - 修 lint 配置
  - 再决定 D2 扩面到哪里

### 代码侧

- 先修 `eslint.config.mjs`，让 `pnpm lint` 回到可用
- 再决定 compiler frontend 下一步是：
  - 扩输入面
  - 补错误模型
  - 还是继续扩大 TSX example 覆盖
- `VIRTUAL_LIST` 还停在最小正确性版本，性能化仍未开始
- channel / resource / async 这条线还没有系统推进

## 现在可以直接当作事实基线的文件

- `README.md`
- `docs/01-overview/roadmap.md`
- `docs/02-core-specs/compiler-strategy.md`
- `packages/compiler/src/index.ts`
- `packages/compiler/src/frontend/index.ts`
- `packages/compiler/src/frontend/compile-module.ts`
- `packages/compiler/test/compiler.test.ts`
- `examples/web-playground/src/compiler-canary.component.tsx`
- `examples/web-playground/src/compiler-canary.generated.ts`
- `examples/web-playground/src/operations-deck.component.tsx`
- `examples/web-playground/src/operations-deck.generated.ts`
- `examples/web-playground/src/tab-panel.ts`
