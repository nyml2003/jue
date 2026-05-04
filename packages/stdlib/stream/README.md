# @jue/stream

`jue` 框架的**响应式流库**。提供可组合、可取消的异步数据流，支持 `map`、`filter`、`scan`、`merge`、`takeUntil` 等操作符，以及与框架信号系统和通道的互操作。

## 职责

- **响应式流**：基于发布-订阅模式的数据流，支持链式操作符组合
- **信号桥接**：将 `@jue/runtime-core` 的 `SignalBridge` 转换为流，或将流写入信号
- **通道桥接**：将 `@jue/runtime-core` 的 `Channel` 转换为流
- **资源桥接**：将流绑定到异步资源状态（`ResourceState`），自动管理 pending/ready/error 生命周期

## API

### 创建流

```ts
import { createStream } from "@jue/stream";

const { stream, emit } = createStream<number>();

const unsub = stream.subscribe(value => console.log(value));
emit(1);  // 打印 1
emit(2);  // 打印 2
unsub.unsubscribe();
```

### 操作符

```ts
import { createStream, mergeStreams } from "@jue/stream";

const { stream: numbers, emit } = createStream<number>();

// map
const doubled = numbers.map(n => n * 2);

// filter
const evens = numbers.filter(n => n % 2 === 0);

// scan（累加器）
const sum = numbers.scan((acc, n) => acc + n, 0);

// distinctUntilChanged
const distinct = numbers.distinctUntilChanged();

// merge
const merged = numbers.merge(otherStream);

// takeUntil（当 notifier 发射时自动取消订阅）
const limited = numbers.takeUntil(stopSignal);
```

### 信号桥接

```ts
import { createSignalBridge, fromSignal, toSignal } from "@jue/stream";

// 信号 → 流
const signal = createSignalBridge(0);
const stream = fromSignal(signal);

// 流 → 信号
const { stream: source, emit } = createStream<number>();
const target = createSignalBridge(0);
toSignal(source, target);
```

### 通道桥接

```ts
import { createChannel, fromChannel, toChannel } from "@jue/stream";

const channel = createChannel<string>("messages");
const stream = fromChannel(channel);

toChannel(stream, channel, Lane.VISIBLE_UPDATE);
```

### 资源桥接

将流的每次发射转换为异步加载：

```ts
import { toResource } from "@jue/stream";

const resource = toResource(userIdStream, {
  load: async (userId) => {
    const res = await fetch(`/api/users/${userId}`);
    return res.json();
  },
  lane: Lane.VISIBLE_UPDATE
});

resource.status(); // ResourceStatus
resource.value();  // User | null
resource.error();  // unknown
```

## 流类型

```ts
interface JueStream<T> {
  subscribe(listener: (value: T) => void): StreamSubscription;
  map<U>(mapper: (value: T) => U): JueStream<U>;
  filter(predicate: (value: T) => boolean): JueStream<T>;
  scan<U>(reducer: (accumulator: U, value: T) => U, seed: U): JueStream<U>;
  distinctUntilChanged(compare?: (left: T, right: T) => boolean): JueStream<T>;
  merge(...streams: readonly JueStream<T>[]): JueStream<T>;
  takeUntil(notifier: JueStream<unknown>): JueStream<T>;
}
```

## 与相关包的关系

- `@jue/runtime-core`：使用 `Channel`、`ResourceState`、`publishChannel`、`subscribeChannel`、`createResourceState` 等 API
- `@jue/shared`：使用 `Lane`、`ResourceStatus`
