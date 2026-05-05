# @jue/compiler

`jue` 框架的**编译器**。负责将 TSX/JSX 组件源码编译为可供运行时执行的紧凑 Blueprint（二进制风格的数据结构）。

编译器本身**不依赖任何平台**，可在 Node.js 中运行，也支持按需 bundle 到前端工具链中使用。

---

## 目录结构

```
src/
├── index.ts                    # 默认入口（已废弃，见下方说明）
├── cli.ts                      # jue-compile CLI 二进制
├── block-ir.ts                 # BlockIR 类型定义 + lowering 实现（职责混合，待拆分）
├── blueprint-builder.ts        # 命令式 BlueprintBuilder API
├── builder.ts                  # @jue/compiler/builder 子包入口（re-export）
├── ir.ts                       # @jue/compiler/ir 子包入口（re-export）
├── lowering.ts                 # @jue/compiler/lowering 子包入口（re-export）
└── frontend/
    ├── index.ts                # @jue/compiler/frontend 子包入口
    ├── parse.ts                # Babel parser 封装（TSX → AST）
    ├── root-component.ts       # AST 中查找根组件
    ├── compile-to-block-ir.ts  # AST → BlockIR（编译器核心，~2000 行）
    └── compile-module.ts       # 模块级编译：BlockIR → Blueprint → 生成 .generated.ts
```

### 文件职责对照表

| 文件 | 实际职责 | 注意 |
|---|---|---|
| `src/index.ts` | 默认入口。`compile()` 已废弃并返回 `COMPILE_MOVED` 错误；仅保留 builder 相关 re-export | 新代码应使用 `@jue/compiler/frontend` |
| `src/cli.ts` | `jue-compile` 命令行工具，读取 `.component.tsx` 输出 `.generated.ts` | 独立二进制，不依赖 frontend 子包的 `compile()` |
| `src/frontend/parse.ts` | 封装 `@babel/parser`，输出 Babel AST | 12 行，纯适配层 |
| `src/frontend/root-component.ts` | 在 AST 中查找根组件（默认 `render`，或自定义 `rootSymbol`） | 支持函数声明、导出函数、箭头函数、函数表达式 |
| `src/frontend/compile-to-block-ir.ts` | **编译器核心**：AST 遍历 → signal 识别 → JSX 处理 → binding 生成 → BlockIR | 目前单文件 ~2000 行，包含所有前端编译逻辑 |
| `src/frontend/compile-module.ts` | **模块编译器**： orchestrate 整个模块编译流程（parse → BlockIR → lowering → serialize → AST codegen） | 生成最终 `.generated.ts` 代码，使用 Babel AST + `@babel/generator` |
| `src/block-ir.ts` | **职责混合**：BlockIR 类型定义 + `lowerBlockIRToBlueprint()` 实现 | 类型和 lowering 逻辑耦合在同一文件，是主要架构债之一 |
| `src/blueprint-builder.ts` | 命令式 API：逐步构建节点、绑定、区域，输出 BlockIR 或 Blueprint | 用于程序化生成组件结构，或测试 fixture |
| `src/builder.ts` | `@jue/compiler/builder` 子包入口，re-export `blueprint-builder.ts` | 无独立逻辑 |
| `src/ir.ts` | `@jue/compiler/ir` 子包入口，re-export `block-ir.ts` 的类型 | 无独立逻辑 |
| `src/lowering.ts` | `@jue/compiler/lowering` 子包入口，re-export `block-ir.ts` 的 lowering | 无独立逻辑；lowering 实现在 `block-ir.ts` |

---

## 编译数据流

```
.component.tsx
    │
    ▼
@babel/parser  ──►  Babel AST
    │
    ▼
compile-to-block-ir  ──►  BlockIR（声明式中间表示）
    │                              - IRNode（节点树）
    │                              - IRBinding（信号→节点绑定）
    │                              - IRRegion（动态区域：条件/列表/虚拟列表）
    ▼
lowerBlockIRToBlueprint  ──►  Blueprint（运行时输入）
    │                              - Uint8Array/Uint32Array 字段
    │                              - signalToBindings 依赖表
    ▼
generate()  ──►  .generated.ts（可执行模块）
```

### 阶段说明

| 阶段 | 输入 | 输出 | 负责文件 |
|---|---|---|---|
| Parse | TSX 源码字符串 | Babel AST | `frontend/parse.ts` |
| Root Resolve | Babel AST | 根组件 AST 节点 | `frontend/root-component.ts` |
| Compile | Babel AST + 根组件 | BlockIR | `frontend/compile-to-block-ir.ts` |
| Lowering | BlockIR | Blueprint | `block-ir.ts`（`lowerBlockIRToBlueprint`） |
| Module Codegen | Blueprint + 运行时语句 | `.generated.ts` | `frontend/compile-module.ts` |

---

## 子包导出

`package.json` 定义了以下 `exports`：

### `@jue/compiler`（默认入口）—— 已废弃

**不要直接使用默认入口。** 默认入口的 `compile()` 已废弃并返回 `COMPILE_MOVED` 错误。保留默认入口仅用于向后兼容的 builder 类型 re-export。

### `@jue/compiler/frontend`（推荐入口）

编译前端，包含 AST 解析、BlockIR 生成、模块编译与序列化：

```ts
import { compile, compileSourceToBlockIR, compileModule } from "@jue/compiler/frontend";

// 1. 源码 → Blueprint（完整编译）
const result = compile(source, { rootSymbol: "App" });

// 2. 源码 → BlockIR（中间表示）
const blockResult = compileSourceToBlockIR(source);

// 3. 模块编译（含序列化，输出 .generated.ts 代码）
const moduleResult = compileModule(source);
```

### `@jue/compiler/ir`

BlockIR 的类型定义：

```ts
import type { BlockIR, IRNode, IRBinding, IRRegion } from "@jue/compiler/ir";
```

> **注意**：`@jue/compiler/ir` 只是 `@jue/compiler/block-ir.ts` 的类型 re-export。 lowering 逻辑不在此子包。

### `@jue/compiler/lowering`

IR 降级函数：

```ts
import { lowerBlockIRToBlueprint } from "@jue/compiler/lowering";
```

> **注意**：`@jue/compiler/lowering` 只是 `@jue/compiler/block-ir.ts` 中 `lowerBlockIRToBlueprint` 的 re-export。

### `@jue/compiler/builder`

命令式 Blueprint 构造器，用于程序化生成组件结构：

```ts
import { createBlueprintBuilder } from "@jue/compiler/builder";

const builder = createBlueprintBuilder();
const root = builder.element("View");
const text = builder.text("Hello");
builder.append(root, text);
builder.bindText(text, 0);

const ir = builder.buildIR();
const blueprint = builder.buildBlueprint();
```

> **注意**：`@jue/compiler/builder` 只是 `@jue/compiler/blueprint-builder.ts` 的 re-export。

---

## CLI

编译器暴露 `jue-compile` 二进制，用于构建时生成 `.generated.ts`：

```bash
jue-compile --input src/page.component.tsx --output src/generated/page.generated.ts
jue-compile --input src/page.component.tsx --output src/generated/page.generated.ts --root-symbol App
```

CLI 直接调用 `compileModule()` 生成代码，不经过 frontend 子包的 `compile()`。

---

## 核心数据结构

### BlockIR

编译器的中间表示（Intermediate Representation），比 Blueprint 更贴近源码语义：

```ts
interface BlockIR {
  readonly signalCount: number;
  readonly initialSignalValues?: readonly unknown[];
  readonly nodes: readonly IRNode[];       // 节点树
  readonly bindings: readonly IRBinding[]; // 信号到节点的绑定
  readonly regions?: readonly IRRegion[];  // 动态区域（条件、列表等）
}
```

**IRNode**：
- `element` —— 宿主原语节点（View、Text 等）
- `text` —— 静态文本节点

**IRBinding**：
- `text` —— 文本内容绑定
- `prop` / `style` —— 属性/样式绑定
- `event` —— 事件绑定
- `region-switch` —— 条件区域分支切换绑定

**IRRegion**：
- `conditional` —— 条件渲染区域（如 `Show`）
- `keyed-list` —— 键控列表区域（如 `List`）
- `nested-block` —— 嵌套子块区域
- `virtual-list` —— 虚拟列表区域（如 `VirtualList`）

### Blueprint

Lowering 后的运行时输入，由 `Uint8Array`/`Uint32Array` 等 TypedArray 字段构成扁平布局。详见 `docs/04-ir-spec.md`。

---

## 已知架构债

| 问题 | 位置 | 说明 |
|---|---|---|
| 类型与 lowering 耦合 | `src/block-ir.ts` | `BlockIR` 类型定义和 `lowerBlockIRToBlueprint` 实现在同一文件，应拆分为 `ir.ts`（类型）和 `lowering.ts`（实现） |
| 编译核心过大 | `src/frontend/compile-to-block-ir.ts` | 单文件 ~2000 行，包含 AST 遍历、signal 识别、JSX 处理、binding 生成等所有逻辑，应拆分为多个阶段文件 |
| re-export 文件过多 | `builder.ts`, `ir.ts`, `lowering.ts` | 这些文件只有 re-export 逻辑，但文件名暗示它们是实现主体，容易误导 |
| 默认入口半废弃 | `src/index.ts` | `compile()` 已废弃但入口仍然保留，应彻底清理或重定向 |

---

## 构建说明

编译器依赖 `@babel/parser`、`@babel/traverse`、`@babel/types`、`@babel/generator` 来解析和操作 AST。在 Node 平台打包时，非 `@jue/*` 依赖会被 externalize（不打包进产物），因此 Node 环境使用时需确保这些依赖已安装。
