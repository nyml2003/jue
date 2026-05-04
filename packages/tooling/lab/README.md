# @jue/lab

`jue` 框架的**测试、检查与基准测试基础设施**。管理示例应用、分析编译产物、批量运行编译测试，并对编译性能进行基准测量。

## 子模块

### `@jue/lab/examples`

示例应用管理。扫描 `packages/examples/web-playground/apps` 目录，为每个示例生成标准化的路径定义：

```ts
import { listExampleApps, getExampleAppDefinition } from "@jue/lab/examples";

const apps = await listExampleApps();
// [{ id: "counter", appRoot: "...", componentPath: "...", ... }]
```

### `@jue/lab/inspect`

编译产物分析工具。统计 Blueprint 和 CompiledModule 的结构指标：

```ts
import { inspectCompiledModule, inspectSerializedBlueprint } from "@jue/lab/inspect";

const summary = inspectCompiledModule(compiledModule);
// {
//   nodeCount: 5,
//   bindingCount: 3,
//   regionCount: 1,
//   signalCount: 2,
//   bindingOpcodes: [0, 2, 6],
//   regionTypes: [0],
//   handlerCount: 1,
//   keyedListDescriptorCount: 0,
//   virtualListDescriptorCount: 0,
//   runtimeLineCount: 42
// }
```

### `@jue/lab/testkit`

测试工具集。加载示例源码、编译 fixture、批量编译验证：

```ts
import { loadExampleFixtureSource, compileFixtureSource, compileAllExampleFixtures } from "@jue/lab/testkit";

// 加载单个示例源码
const source = await loadExampleFixtureSource("counter");

// 编译单个 fixture
const result = compileFixtureSource(source.value.source, { rootSymbol: "render" });

// 批量编译所有示例
const all = await compileAllExampleFixtures();
```

### `@jue/lab/bench`

编译性能基准测试：

```ts
import { benchmarkExampleCompilation } from "@jue/lab/bench";

const result = await benchmarkExampleCompilation("counter", 10);
// {
//   exampleId: "counter",
//   iterations: 10,
//   durationsMs: [12.3, 11.8, ...],
//   avgMs: 12.1,
//   minMs: 11.5,
//   maxMs: 13.2
// }
```

## CLI

```bash
# 编译所有示例
pnpm exec tsx ./src/cli.ts compile-examples

# 运行基准测试
pnpm exec tsx ./src/cli.ts bench
```

## 与相关包的关系

- `@jue/compiler/frontend`：编译示例源码
- `@jue/shared`：使用 `Result` 类型
