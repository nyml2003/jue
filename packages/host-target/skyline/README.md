# `@jue/skyline`

小程序/Skyline 官方 host target 包。当前作为 Node 侧 compile-time target，负责把 authoring 产物编译成小程序工程壳（WXML/WXSS/JS/JSON）和 `setData` flush glue。

## 内部文档

- [小程序 Target 策略](./docs/miniprogram-target-strategy.md) — 模板宿主路线、编译后端分流、与 glass-easel 的关系

## 上层文档

- [宿主适配规范](../../docs/10-specs/08-host-adapter-spec.md)
- [场景覆盖](../../docs/10-specs/09-scenario-coverage.md)
