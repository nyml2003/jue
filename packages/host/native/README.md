# @jue/native

`jue` 框架的 **Native 宿主适配器占位包**。

当前状态为 **预留（reserved）**，尚未实现具体的 Native 平台（iOS/Android）适配逻辑。

## 当前状态

```ts
export interface NativeHostAdapterPlaceholder {
  readonly status: "reserved";
}

export const nativeHostAdapterPlaceholder: NativeHostAdapterPlaceholder = {
  status: "reserved"
};
```

## 未来规划

本包将负责：

- 实现 `HostAdapter` 接口，将 runtime-core 的操作映射到原生 UI 框架（如 iOS UIKit、Android View 系统）
- 提供 Native 平台的组件挂载、信号更新和事件处理 API
- 支持 React Native、Flutter 或其他原生渲染引擎的集成

## 与相关包的关系

- `@jue/runtime-core`：将提供 BlockInstance、Blueprint、HostAdapter 等抽象供本包实现
- `@jue/compiler`：输出 Blueprint 供本包挂载到原生视图树
