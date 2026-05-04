# @jue/compiler

`jue` 框架的**编译器**。负责将 TSX/JSX 组件源码编译为可供运行时执行的紧凑 Blueprint（二进制风格的数据结构）。

编译器本身**不依赖任何平台**，可在 Node.js 中运行，也支持按需 bundle 到前端工具链中使用。

## 编译流程

```
TSX 源码
   │
   ▼
@babel/parser  →  AST
   │
   ▼
compileSourceToBlockIR  →  BlockIR（中间表示）
   │
   ▼
lowerBlockIRToBlueprint  →  Blueprint（运行时产物）
```

## 子包导出

### `@jue/compiler`（默认入口）

高层 API，一键完成从源码到 Blueprint 的完整编译：

```ts
import { compile } from "@jue/compiler";

const result = compile(source, { rootSymbol: "App" });
if (result.ok) {
  // result.value 是 Blueprint，可直接交给 runtime-core 实例化
}
```

### `@jue/compiler/frontend`

编译前端，包含 AST 解析、BlockIR 生成、模块编译与序列化：

```ts
import { compileSourceToBlockIR, compileModule } from "@jue/compiler/frontend";

// 1. 源码 → BlockIR（中间表示）
const blockResult = compileSourceToBlockIR(source);

// 2. 模块编译（含序列化，便于跨线程/跨端传输）
const moduleResult = compileModule(source);
```

### `@jue/compiler/ir`

BlockIR 的类型定义与降级函数：

```ts
import type { BlockIR, IRNode, IRBinding, IRRegion } from "@jue/compiler/ir";
import { lowerBlockIRToBlueprint } from "@jue/compiler/ir";
```

### `@jue/compiler/lowering`

IR 降级相关的底层逻辑（通常不需要直接使用）。

### `@jue/compiler/builder`

命令式 Blueprint 构造器，用于程序化生成组件结构：

```ts
import { createBlueprintBuilder } from "@jue/compiler/builder";

const builder = createBlueprintBuilder();
const root = builder.element("View");
const text = builder.text("Hello");
builder.append(root, text);
builder.bindText(text, 0); // signal slot 0 驱动文本内容

const ir = builder.buildIR();
const blueprint = builder.buildBlueprint();
```

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
- `nested-block` —— 嵌套子块区域（如 `Portal`）
- `virtual-list` —— 虚拟列表区域（如 `VirtualList`）

### BlueprintBuilder

命令式构造器，逐步构建节点、绑定和区域：

| 方法 | 用途 |
|------|------|
| `element(type)` | 创建元素节点 |
| `text(value)` | 创建文本节点 |
| `append(parent, child)` | 建立父子关系 |
| `bindText(node, signal)` | 绑定文本到信号 |
| `bindProp(node, key, signal)` | 绑定属性到信号 |
| `bindStyle(node, key, signal)` | 绑定样式到信号 |
| `bindEvent(node, event, handler)` | 绑定事件 |
| `defineConditionalRegion(...)` | 定义条件区域 |
| `defineKeyedListRegion(...)` | 定义键控列表区域 |
| `buildIR()` | 输出 BlockIR |
| `buildBlueprint()` | 直接输出 Blueprint |

## 编译器前端的能力

`compileSourceToBlockIR` 在遍历 AST 时会自动处理：

- **Signal 识别**：从源码中提取响应式信号，建立 signal slot 映射
- **Host Primitive**：识别 `<View>`、`<Text>` 等原生宿主标签
- **Structure Primitive**：识别 `<Show>`、`<List>`、`<VirtualList>` 等控制流标签
- **Event Handler**：收集 `onPress`、`onInput` 等事件处理器
- **Template Scope**：为列表项模板创建隔离的信号作用域
- **Static Analysis**：区分静态内容和动态绑定，减少运行时开销

## 构建说明

编译器依赖 `@babel/parser`、`@babel/traverse`、`@babel/types`、`@babel/generator` 来解析和操作 AST，但这些依赖在 bundle 时会被**打包进产物**（不列为 external），因此下游使用时无需额外安装 Babel。
