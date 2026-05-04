# @jue/primitives

定义 `jue` 框架的**结构型原语（Structure Primitives）**及其支持状态矩阵。

与 `@jue/shared` 中定义的 `HostPrimitive`（View、Text 等跨平台 UI 原子）不同，结构型原语是**控制流和布局抽象**，由编译器识别并转换为特定的运行时区域（Region）。

## 结构型原语

| 原语 | 实现状态 | 运行时区域 |
|------|----------|------------|
| `Show` | ✅ 已实现 | 条件渲染区域（`conditional`） |
| `List` | ✅ 已实现 | 键控列表区域（`keyed-list`） |
| `VirtualList` | ✅ 已实现 | 虚拟列表区域（`virtual-list`） |
| `Portal` | ⏳ 预留 | 嵌套块区域（`nested-block`） |
| `Boundary` | ⏳ 预留 | 边界处理区域 |

## API

```ts
import { Show, List, VirtualList, Portal, Boundary } from "@jue/primitives";
import { isStructurePrimitiveName, getPrimitiveSupport, listStructurePrimitives } from "@jue/primitives";
```

### 支持状态查询

```ts
const support = getPrimitiveSupport("Show");
// { implemented: true, phase: "phase-2", notes: "Compiles to conditional regions." }
```

### 校验

```ts
isStructurePrimitiveName("Show");   // true
isStructurePrimitiveName("Foo");    // false
```

## 在 JSX 中的使用

结构型原语在组件源码中直接作为 JSX 标签使用：

```tsx
import { Show, List } from "@jue/primitives";

function App() {
  const visible = signal(true);
  const items = signal([{ id: 1, name: "A" }]);

  return (
    <View>
      <Show when={visible}>
        <Text>Hello</Text>
      </Show>
      <List each={items} key="id">
        {(item) => <Text>{item.name}</Text>}
      </List>
    </View>
  );
}
```

编译器会在 AST 遍历阶段识别这些标签，并生成对应的 `IRRegion`。

## 设计说明

- **常量字符串**：每个原语都是 `as const` 字符串，便于编译器做静态匹配。
- **支持矩阵**：`PRIMITIVE_SUPPORT` 记录了每个原语的实现阶段和备注，供 `@jue/authoring-check` 在开发阶段提示用户哪些原语尚未就绪。
