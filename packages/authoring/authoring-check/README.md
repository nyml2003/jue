# @jue/authoring-check

开发阶段的**源码检查工具**。在组件源码编写或提交前运行，分析源码中使用的原语是否在目标平台已就绪，并报告编译错误。

## 职责

- **扫描引用的原语**：通过正则匹配提取源码中使用的 `Show`、`List`、`VirtualList`、`Portal`、`Boundary` 等结构型原语
- **对比实现状态**：将引用的原语与 `@jue/primitives` 中的支持矩阵对比，标记哪些已实现、哪些仅是预留
- **编译预检**：调用 `@jue/compiler/frontend` 对源码做一次编译，捕获语法/语义错误
- **生成诊断报告**：统一输出 `error` 和 `info` 级别的诊断信息

## API

```ts
import { checkAuthoringSource, collectReferencedPrimitives } from "@jue/authoring-check";

// 完整检查
const result = checkAuthoringSource(source, { rootSymbol: "App" });
console.log(result.ok);           // 是否有 error 级别诊断
console.log(result.diagnostics);  // 诊断列表
console.log(result.primitives);   // 各原语的引用与实现状态

// 仅收集引用的原语
const referenced = collectReferencedPrimitives(source);
// ["Show", "List"]
```

## 诊断结构

```ts
interface AuthoringCheckResult {
  readonly ok: boolean;                          // 无 error 则为 true
  readonly primitives: AuthoringPrimitiveStatus[]; // 各原语状态
  readonly diagnostics: AuthoringDiagnostic[];     // 诊断列表
}

interface AuthoringPrimitiveStatus {
  readonly primitive: StructurePrimitiveName;
  readonly referenced: boolean;   // 当前源码是否引用了该原语
  readonly implemented: boolean;  // 该原语在运行时是否已实现
  readonly notes: string;         // 实现阶段说明
}

interface AuthoringDiagnostic {
  readonly severity: "error" | "info";
  readonly code: string;
  readonly message: string;
}
```

## 典型使用场景

### CI 预检

在持续集成中运行，防止提交包含未实现原语的组件源码：

```ts
const result = checkAuthoringSource(source);
if (!result.ok) {
  for (const d of result.diagnostics) {
    console.error(`[${d.severity}] ${d.code}: ${d.message}`);
  }
  process.exit(1);
}
```

### IDE 提示

集成到文档生成工具或语言服务器，为开发者提供实时的原语可用性提示。

## 与相关包的关系

- `@jue/primitives`：获取原语支持矩阵
- `@jue/compiler/frontend`：执行编译预检
