# `@jue/lab`

实验与测试工具集。合并了 example registry、inspect、testkit、bench 四类能力，通过子路径导出保持语义边界。

## 子路径

- `@jue/lab/examples` — 示例注册表与路径定义
- `@jue/lab/inspect` — 编译示例并产出统计摘要
- `@jue/lab/testkit` — fixture 加载与批量编译
- `@jue/lab/bench` — 编译性能基准测试

## CLI

```bash
pnpm bench                    # 跑 benchmark
pnpm compile-examples         # 编译所有示例组件
```
