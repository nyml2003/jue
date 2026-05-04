# @jue/docsgen

`jue` 仓库的**文档生成与工程报告工具**。扫描 workspace 状态，自动生成支持矩阵、拓扑依赖报告和包体积分析。

## 职责

- **支持矩阵**：汇总各结构型原语（Primitive）的实现状态、示例数量、编译 fixture 数量
- **拓扑扫描**：分析 monorepo 中各 package 的依赖关系，生成拓扑报告
- **体积分析**：扫描各 package 的 `dist` 产物体积
- **文档片段生成**：为 `docs/` 目录生成可嵌入的 Markdown 片段

## CLI 使用

```bash
# 生成所有报告
pnpm exec tsx ./src/cli.ts

# 或单独运行某类报告
pnpm exec tsx ./src/cli.ts status    # 支持矩阵
pnpm exec tsx ./src/cli.ts topology  # 拓扑依赖
pnpm exec tsx ./src/cli.ts sizes     # 体积分析
```

## 程序化 API

```ts
import { generateSupportMatrix, generateExampleRegistrySnippet, generateCoreSpecSnippet } from "@jue/docsgen";

const matrix = await generateSupportMatrix();
// 输出 Markdown 格式的支持矩阵表格

const registry = await generateExampleRegistrySnippet();
// 输出示例应用注册表

const spec = await generateCoreSpecSnippet();
// 输出核心规范片段
```

## 生成的报告示例

### 支持矩阵

```markdown
# Support Matrix

Examples tracked: 3
Compiled fixtures: 12

| Primitive | Implemented | Notes |
| --- | --- | --- |
| Show | yes | Compiles to conditional regions. |
| List | yes | Compiles to keyed-list regions. |
| VirtualList | yes | Compiles to virtual-list regions. |
| Portal | no | Reserved primitive; host/runtime support is not active yet. |
| Boundary | no | Reserved primitive; boundary runtime is not active yet. |
```

### 拓扑报告

拓扑扫描器会遍历所有 workspace package，分析 `package.json` 中的 `dependencies`，生成依赖图谱并写入：

```
docs/30-engineering/monorepo-topology.registry.json
```

### 体积报告

扫描每个 package 的 `dist/` 目录，统计 JS 和类型声明文件的总体积。

## 与相关包的关系

- `@jue/authoring-check`：获取原语支持矩阵
- `@jue/lab/examples`、`@jue/lab/testkit`：获取示例列表和编译 fixture
- `@jue/devtrace`：追踪文档生成事件
