# `@jue/compiler`

Kernel 编译器。负责把 TSX 作者输入转换成 `BlockIR`，再经 lowering 产出 `Blueprint` 或模板宿主 target artifact。

## 内部文档

- [编译策略](./docs/compiler-strategy.md) — 三层编译主链与职责边界
- [IR 规范](./docs/ir-spec.md) — `BlockIR`、`Blueprint` 与运行时数据布局

## 上层文档

- [Authoring Grammar 规范](../../docs/10-specs/01-authoring-grammar-spec.md)
- [API 草案](../../docs/10-specs/02-api-draft.md)
- [场景覆盖](../../docs/10-specs/09-scenario-coverage.md)
