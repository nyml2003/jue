# @jue/skyline

`jue` 框架的 **微信小程序 Skyline 引擎目标编译器**。将 `@jue/compiler` 产出的 BlockIR 进一步降级为 Skyline 引擎可消费的 `SkylineArtifact`，包含 WXML 风格模板、绑定计划和区域描述。

## 职责

- **BlockIR → SkylineArtifact**：将编译器的中间表示（BlockIR）转换为微信小程序 Skyline 渲染引擎需要的特定格式
- **模板代码生成**：将节点树序列化为类似 WXML 的模板字符串（如 `<view>{{signals.s0}}</view>`）
- **绑定计划**：提取信号到节点属性/文本/样式的绑定关系
- **区域降级**：将条件区域（conditional）和键控列表区域（keyed-list）转换为 Skyline 支持的动态区域描述

## API

```ts
import { compileSkylineSource, compileSkylineBlockIR } from "@jue/skyline";

// 从源码直接编译
const result = compileSkylineSource(source, { rootSymbol: "App" });

// 从已有的 BlockIR 编译
const result2 = compileSkylineBlockIR(blockIR);
```

## SkylineArtifact 结构

```ts
interface SkylineArtifact {
  readonly signalCount: number;                  // 信号总数
  readonly initialSignalValues: readonly unknown[];
  readonly signalData: Readonly<Record<string, unknown>>;  // 信号初始数据
  readonly template: readonly SkylineTemplateNode[];        // 模板节点树
  readonly templateCode: string;                             // WXML 风格模板字符串
  readonly bindings: readonly SkylineBindingPlan[];          // 绑定计划
  readonly conditionals: readonly SkylineConditionalDescriptor[];  // 条件区域
  readonly keyedLists: readonly SkylineListDescriptor[];     // 键控列表区域
}
```

### 模板节点

```ts
type SkylineTemplateNode =
  | { kind: "element"; type: HostPrimitive; id: number; parent: number | null }
  | { kind: "text"; type: "#text"; id: number; parent: number | null; staticText: string };
```

### 绑定计划

```ts
interface SkylineBindingPlan {
  readonly kind: "text" | "prop" | "style" | "region-switch";
  readonly node: number;      // 作用的节点 id
  readonly key?: string;      // 属性/样式名
  readonly signal: number;    // 信号 slot
  readonly valuePath: string; // 值路径，如 "signals.s0"
}
```

### 条件区域

```ts
interface SkylineConditionalDescriptor {
  readonly kind: "conditional";
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly branches: readonly { startNode: number; endNode: number }[];
}
```

### 键控列表区域

```ts
interface SkylineListDescriptor {
  readonly kind: "keyed-list";
  readonly anchorStartNode: number;
  readonly anchorEndNode: number;
  readonly sourceSignalSlot?: number;
  readonly keyPath?: readonly string[];
  readonly template?: SkylineListTemplateDescriptor;  // 列表项模板
}
```

## 模板代码示例

输入 JSX：

```tsx
<View>
  <Text>{message}</Text>
  <Show when={visible}>
    <Text>Hello</Text>
  </Show>
</View>
```

生成的 `templateCode`：

```xml
<view>
  <text>{{signals.s0}}</text>
  <block wx:if="{{signals.s1}}">
    <text>Hello</text>
  </block>
</view>
```

> 注意：实际输出格式由 Skyline 引擎消费，本包生成的 `templateCode` 是面向 Skyline 的 WXML 风格标记。

## 限制

当前 Skyline 目标不支持以下特性：

- **事件绑定**（`event` bindings）— 返回 `SKYLINE_EVENT_UNSUPPORTED` 错误
- **虚拟列表区域**（`virtual-list`）— 返回 `SKYLINE_REGION_UNSUPPORTED` 错误
- **嵌套块区域**（`nested-block`）— 返回 `SKYLINE_REGION_UNSUPPORTED` 错误

## 与相关包的关系

- `@jue/compiler` / `@jue/compiler/frontend`：提供 `compileSourceToBlockIR`，输出 BlockIR
- `@jue/shared`：提供 `HostPrimitive`、`Result` 等基础类型
