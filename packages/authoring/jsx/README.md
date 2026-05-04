# @jue/jsx

`jue` 框架的 **JSX 运行时与类型定义层**。提供开发者在编写组件源码时需要的类型、辅助函数和 JSX 全局命名空间声明。

## 职责

- 声明全局 `JSX` 命名空间，让 TypeScript 识别框架自定义的 JSX 类型
- 导出所有**宿主原语**（Host Primitives）常量：`View`、`Text`、`Button`、`Input`、`Image`、`ScrollView`
- 导出所有**结构型原语**（Structure Primitives）：`Show`、`List`、`VirtualList`、`Portal`、`Boundary`
- 提供基础 `signal()` 工厂函数（开发阶段简化版，非生产运行时信号系统）

## 类型声明

本包包含一个手写的声明文件 `src/jsx-runtime.d.ts`，用于声明框架的 JSX 类型系统。TypeScript 在编译 `.tsx` 文件时会使用该声明来校验 JSX 元素和属性。

## API

### 宿主原语

```ts
import { View, Text, Button, Input, Image, ScrollView } from "@jue/jsx";
```

这些常量在源码中作为 JSX 标签使用：

```tsx
function App() {
  return (
    <View>
      <Text>Hello</Text>
      <Button onPress={handlePress}>Click me</Button>
    </View>
  );
}
```

### 结构型原语

```ts
import { Show, List, VirtualList, Portal, Boundary } from "@jue/jsx";
```

### Signal 辅助

```ts
import { signal } from "@jue/jsx";

const count = signal(0);
count.set(1);
count.update(n => n + 1);
```

> 注意：这里的 `signal()` 是面向**开发体验**的简化实现，与 `@jue/runtime-core` 中基于 slot 的高性能信号系统不同。源码经编译器处理后，运行时使用的是 runtime-core 的底层信号机制。

## 与相关包的关系

- `@jue/primitives`：提供结构型原语的实现状态矩阵和校验函数
- `@jue/shared`：提供 `HostPrimitive` 基础类型

`@jue/jsx` 主要面向** authoring（编写源码）** 阶段，是开发者直接接触的 API 层。
