# 为什么需要 tsconfig.json 和 tsconfig.build.json

## 两个场景

### 场景一：开发时 typecheck

你在 `@jue/shared` 里写代码：

```ts
import { createSignal } from "@jue/runtime-core";

export function useSignal() {
  return createSignal(0);
}
```

运行 `pnpm --filter @jue/shared typecheck`，tsc 必须知道 `createSignal(0)` 返回什么类型。

**它去哪找类型？**

| 读哪里 | 结果 |
|--------|------|
| `runtime-core/src/index.ts` ✅ | 源码里有完整类型，包括泛型约束、JSDoc、类型推断 |
| `runtime-core/dist/index.d.ts` ❌ | 产物可能丢失细节；如果还没 build，文件根本不存在 |

**结论：typecheck 时读源码。**

---

### 场景二：build 时 emit `.d.ts`

`shared` 要 build 了，`library` mode 最后一步：

```ts
tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist
```

这会生成 `shared/dist/index.d.ts`：

```ts
import { createSignal } from "@jue/runtime-core";
export declare function useSignal(): ???;
```

`tsc` 需要知道 `createSignal(0)` 的返回类型，才能填 `???`。

**它去哪找类型？**

#### 选项 A：读源码 `runtime-core/src/index.ts`

源码里可能长这样：

```ts
// runtime-core/src/internal.ts
interface InternalOptions {  // 内部类型，不对外暴露
  debug: boolean;
}

// runtime-core/src/index.ts
export function createSignal<T>(value: T, options?: InternalOptions) {
  return new InternalSignalClass(value);  // 内部类
}
```

tsc 读了源码后，知道 `InternalOptions` 和 `InternalSignalClass` 的存在。它在 emit `shared/dist/index.d.ts` 时，**可能不小心把这些内部类型的细节也写进去**：

```ts
// shared/dist/index.d.ts ❌ 泄漏了！
interface InternalOptions { debug: boolean; }  // 这是 runtime-core 的内部东西！
export declare function useSignal(): InternalSignalClass<number>;  // 内部类被暴露了！
```

**问题**：
1. `InternalOptions` 是 `runtime-core` 的私有类型，不应该出现在 `shared` 的公共 API 中
2. `InternalSignalClass` 是内部实现类，用户不该直接用到
3. 下游项目用 `shared` 时，IDE 会提示这些不该暴露的类型，甚至导致类型不兼容

#### 选项 B：读产物 `runtime-core/dist/index.d.ts`

产物里只有 public API：

```ts
// runtime-core/dist/index.d.ts ✅ 干净
export declare function createSignal<T>(value: T): Signal<T>;
export interface Signal<T> { ... }
```

没有 `InternalOptions`，没有 `InternalSignalClass`。

tsc 读这个文件时，只能看到 `createSignal` 的 public 签名。它在 emit `shared/dist/index.d.ts` 时，也只能引用这些 public 类型：

```ts
// shared/dist/index.d.ts ✅ 干净
import { Signal } from "@jue/runtime-core";
export declare function useSignal(): Signal<number>;
```

**结论：build emit 时读产物。**

---

## 另一个原因：构建顺序

`tsconfig.base.json` 设置了 `composite: true`，这是 TypeScript Project References。

Project References 的设计假设：
- 每个包是一个独立 project
- A 引用 B 时，应该引用 B 的 **产物**（`.d.ts`）
- tsc 可以增量编译：B 的源码没变，直接跳过 B，只读 `.d.ts`

如果 build `shared` 时读 `runtime-core` 的源码，tsc 会重新检查 `runtime-core` 的所有类型——即使它刚 build 过。大型 monorepo 里这非常慢。

---

## 为什么不能只用一个 tsconfig？

因为 TypeScript 的 `paths` 只能配一套。你没法同时让：
- typecheck 时 `@jue/runtime-core` → `src/index.ts`
- build 时 `@jue/runtime-core` → `dist/index.d.ts`

所以拆成两个文件，各配各的 paths：

| 文件 | extends | paths 指向 |
|------|---------|-----------|
| `tsconfig.json` | `tsconfig.base.json` | `src/`（源码） |
| `tsconfig.build.json` | `tsconfig.emit.json` | `dist/*.d.ts`（产物） |
