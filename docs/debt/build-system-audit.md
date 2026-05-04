# 构建系统与工程配置现状梳理

> 本文档基于 2026-05-04 的仓库状态整理，未修改任何代码。
> 目标是把构建脚本、TS 配置、产物残留、Lint 规则的真实面貌一次性摊开，供后续优化参考。

---

## 1. package.json 脚本：几乎全是单行

### 1.1 根目录脚本

| 脚本 | 内容 |
|------|------|
| `build` | `pnpm -r --filter "./packages/*/*" run build && pnpm build:examples` |
| `compile:components` | `pnpm exec tsx ./scripts/compile-example-components.ts` |
| `build:examples` | `pnpm --filter @jue/web-playground build` |
| `docs` | `pnpm --filter @jue/docsgen docsgen` |
| `typecheck` | `pnpm exec tsc -p tsconfig.check.json --noEmit --pretty false` |
| `lint` | `eslint .` |
| `test` | `node ./node_modules/vitest/vitest.mjs run` |
| `test:e2e` | `pnpm --filter @jue/web-playground test:e2e` |
| `dev` | `pnpm --filter @jue/web-playground preview` |
| `bench` | `pnpm --filter @jue/lab bench` |

### 1.2 Library package 的 build 脚本模式

所有 library（`authoring-check`、`jsx`、`primitives`、`native`、`web`、`skyline`、`compiler`、`runtime-core`、`shared`、`query`、`router`、`stream`、`devtrace`、`docsgen`、`lab`）的 `build` 都遵循同一行模板：

```bash
node -e "清 dist + 清 .cache" \
&& esbuild src/index.ts --bundle --format=esm ... --outfile=dist/index.js --sourcemap \
&& esbuild src/index.ts ... --minify --outfile=dist/index.min.js \
&& ... \
&& tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist
```

即：**清理 -> 多入口 esbuild（常规 + minify）-> tsc 生成 .d.ts**，全部挤在一行 `&&` 链里。

`typecheck` 脚本则统一是：

```bash
tsc -p tsconfig.json --noEmit
```

### 1.3 Examples 脚本

| 项目 | 单行脚本示例 |
|------|-------------|
| `jue-current-app` | `tsx scripts/compile.ts` / `pnpm run compile && vite` |
| `jue-mobile-showcase` | `tsx scripts/compile-browser.ts` / `pnpm run compile:web && vite` |
| `web-playground` | `pnpm exec tsx ... && pnpm exec tsx ...` |

### 1.4 原因

项目构建逻辑简单直接，用裸 `esbuild + tsc` 链完成，没有引入 `tsup`、`unbuild` 或 npm 脚本拆分（如 `build:js` / `build:types`），因此全部压成单条字符串。

---

## 2. src/ 目录里的 .d.ts 与 .d.ts.map

排除 `node_modules` 后，源码树中共有 **26 个 .d.ts + 24 个 .map**，分三种来历：

### 2.1 故意保留（tracked）

| 文件 | 原因 |
|------|------|
| `packages/authoring/jsx/src/jsx-runtime.d.ts` | **手写声明文件**。定义全局 `JSX` 命名空间与框架 intrinsic elements，让 TypeScript 识别该框架的 JSX。 |
| `packages/authoring/primitives/src/index.d.ts` + `.map` | **历史重构时提交的生成产物**（commit `9dbdbcc`）。当时 `tsc` 生成后未清理，直接 check-in。 |
| `packages/kernel/shared/src/*.d.ts` + `.map`（host / index / opcode / result） | 同上，也是那次重构提交的生成声明。其中 `opcode.d.ts.map` 和 `result.d.ts.map` 当前显示为 **modified**，说明对应 `.ts` 源文件被编辑过，但 map 未重新提交。 |

### 2.2 意外生成（untracked）

| 文件 | 原因 |
|------|------|
| `packages/kernel/compiler/src/*.d.ts` + `.map`（约 10 组） | **某次 `tsc` 误发到了 `src/`**。该 package 的 `build` 脚本明确用 `--outDir dist`，但可能有一次在命令行或 IDE 里直接跑了没带 `--outDir` 的 `tsc`，导致 `.d.ts` 和 `.map` 生成在 `src/` 同级。 |
| `packages/kernel/runtime-core/src/*.d.ts` + `.map`（约 13 组） | 同上，全部是 accidental build artifacts。 |

这些 untracked 文件内容就是标准 `export declare ...` 桩代码 + `//# sourceMappingURL=` 尾注，与 `tsc --declaration` 输出完全一致。

### 2.3 pnpm workspace 镜像

各 package 的 `node_modules/@jue/<dep>/src/` 下也会出现同名 `.d.ts` 和 `.map`，但那是 **pnpm 本地依赖链接/复制** 的产物，不是独立文件，直接镜像了上述两类内容。

### 2.4 为什么能漏进来？

`.gitignore` 忽略了 `dist/` 和 `node_modules/`，但**没有忽略 `src/*.d.ts`**。因此一旦 `tsc` 裸跑到 `src/` 旁，这些文件立刻以 untracked 状态暴露在 git 中。

---

## 3. tsconfig.json 的种类与 tsc 的使用

### 3.1 配置文件总数（排除 node_modules）

共 **36 个** tsconfig 文件。

#### 根目录 3 个 —— 全局 orchestration

| 文件 | 作用 |
|------|------|
| `tsconfig.base.json` | **全局共享基础配置**。定义 `target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`、`strict: true`、`composite: true`、`declaration: true`、`declarationMap: true`。包含所有 `@jue/*` workspace 包的 `paths` 映射（指向 `src/index.ts`）。 |
| `tsconfig.json` | **Project References 入口**。`files: []`，通过 `references` 引用 6 个核心 package（shared、runtime-core、compiler、web、native、web-playground），用于 `tsc --build` 的拓扑编译。 |
| `tsconfig.check.json` | **全局一次性 typecheck**。extends base，设 `noEmit: true`、`composite: false`，`include` 覆盖整个 monorepo。根目录 `typecheck` 脚本跑的就是它。 |

#### Library package 的标配 2 个（15 个 package x 2 = 30 个）

| 文件 | 作用 |
|------|------|
| `tsconfig.json` | **开发/测试配置**。extends `../../../tsconfig.base.json`，`rootDir: "."` 或 `"src"`，`include` 覆盖 `src/**/*.ts` + `test/**/*.ts`。 |
| `tsconfig.build.json` | **构建专用配置**。extends 上面的 `tsconfig.json`，但做了关键调整：① `include` 缩小到仅 `src/**/*.ts`；② `paths` **全部重定向到 `dist/*.d.ts`**（而非 `src/index.ts`），并设 `baseUrl: "../../../"`，保证构建时 `tsc` 解析的是已编译的下游依赖声明；③ 指定 `tsBuildInfoFile` 到 `.cache`。 |

#### Examples 的独立配置（3 个）

| 文件 | 作用 |
|------|------|
| `packages/examples/jue-current-app/tsconfig.json` | Vite 应用配置，**不 extends base**，自己独立写 `paths` 指向各 package 的 `src`。 |
| `packages/examples/jue-mobile-showcase/tsconfig.json` | 同上，应用级配置。 |
| `packages/examples/jue-mobile-showcase/tsconfig.generated.json` | 仅 `include: ["browser/src/generated/**/*.ts"]`，用于 `lint:generated` 脚本。 |

### 3.2 tsc 还在用吗？—— 用得很频繁，但分工明确

`package.json` 中 `tsc` 出现 **22 处**，承担三种角色：

| 角色 | 典型命令 | 出现位置 |
|------|----------|----------|
| **类型检查（无输出）** | `tsc -p tsconfig.json --noEmit` | 几乎每个 package 的 `typecheck` 脚本 |
| **全局类型检查** | `tsc -p tsconfig.check.json --noEmit --pretty false` | 根目录 `typecheck` |
| **生成 .d.ts 声明** | `tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist` | 几乎每个 package 的 `build` 脚本 |
| **生成代码检查** | `tsc -p tsconfig.generated.json --noEmit --pretty false` | `jue-mobile-showcase` 的 `lint:generated` |

**关键结论**：
- **JS 编译不是 tsc 做的**——所有 `.js` 产物都由 `esbuild --bundle` 生成。
- **tsc 只干两件事**：① 类型检查（`--noEmit`）；② 生成 TypeScript 声明文件（`--emitDeclarationOnly`）。
- 这也解释了为什么 `src/` 里会出现意外 `.d.ts`：`declaration: true` + `declarationMap: true` 在 base 配置里全局开启，只要有人在某个 package 下裸跑 `tsc` 没带 `--outDir`，产物就会直接喷到 `src/` 旁边。

---

## 4. ESLint 配置

### 4.1 基本 facts

- **配置文件**：根目录唯一一个 `eslint.config.mjs`（Flat Config 格式）。
- **依赖**：`eslint` ^9.25.0、`@eslint/js` ^9.25.0、`typescript-eslint` ^8.30.1。
- **脚本**：根目录 `"lint": "eslint ."`。

### 4.2 配置结构

```js
export default [
  // 1. 忽略名单
  { ignores: [ "dist/**", "**/dist/**", "coverage/**", "node_modules/**",
               ".omx/**", "**/generated/**", "eslint.config.mjs",
               "vitest.config.ts", "**/vite.config.*", "**/*.js",
               "**/*.mjs", "**/*.js.map", "**/*.d.ts", "**/*.d.ts.map" ] },

  // 2. 基础推荐
  js.configs.recommended,

  // 3. TS 类型感知推荐
  ...tseslint.configs.recommendedTypeChecked,

  // 4. TS/TSX/MTS 详细规则
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.check.json",   // <- 类型感知
        tsconfigRootDir: import.meta.dirname
      },
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "max-len": ["error", { code: 220, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }]
    }
  },

  // 5. .component.tsx 豁免
  {
    files: ["**/*.component.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off"
    }
  }
];
```

### 4.3 关键规则解读

| 规则 | 配置 | 影响 |
|------|------|------|
| `consistent-type-imports` | `error`, prefer `type-imports` | 强制仅做类型使用的 import 必须写成 `import type { ... }`。 |
| `no-explicit-any` | `error` | 禁止显式使用 `any`。 |
| `no-unused-vars` | `error`, 忽略 `^_` | 未使用变量/参数报 error，但 `_` 开头的名字豁免。 |
| `max-len` | `error`, code `220` | 行宽限制 220，注释、字符串、模板字面量不计入。 |
| `no-unsafe-return` / `no-unsafe-assignment` | 对 `.component.tsx` `off` | 组件文件里允许隐式 `any` 的返回和赋值，减少 JSX 写法摩擦。 |

### 4.4 忽略范围

ESLint 实际**只检查源码 .ts/.tsx**。以下全部排除：

- 所有构建产物（`dist/**`）
- 所有 `node_modules`
- 生成代码（`**/generated/**`）
- 配置文件（`eslint.config.mjs`、`vitest.config.ts`、`vite.config.*`）
- 所有 `.js`、`.mjs`、`.d.ts`、`.map` 文件

---

## 5. 关键问题速查表

| 问题 | 现状 | 建议关注方向 |
|------|------|-------------|
| build 脚本过长 | 全部挤在一行 `&&` 链，最长的一条（compiler）超过 1k 字符 | 是否需要拆分成 `build:js` / `build:types` 子脚本，或引入 `tsup`/`unbuild` 封装？ |
| `src/` 里有生成产物 | compiler 和 runtime-core 的 `src/` 下各有约 10+ 组 untracked `.d.ts/.map` | 清理一次，并在 `.gitignore` 增加 `packages/**/src/*.d.ts` 和 `*.d.ts.map` 兜底 |
| `shared` / `primitives` 的 `.d.ts` 是 tracked | 历史提交遗留，与源码并行存在 | 确认是否仍需要——如果 `build` 已经能重新生成，建议从 git 移除，避免与源码不同步 |
| tsconfig 数量多 | 36 个文件，维护成本高 | `tsconfig.build.json` 里的 `paths` 块几乎完全相同（全部重定向到 `dist/*.d.ts`），是否有机会抽成共享配置或脚本生成？ |
| tsc 与 esbuild 分工 | JS 由 esbuild 编译，tsc 只做类型检查和生成 `.d.ts` | 当前是合理且常见的组合，保持即可 |
| ESLint 只检 TS | `.js`、`.mjs`、`.d.ts` 全被忽略 | 如果未来要写 Node 脚本（`scripts/`、`vite.config.ts`），可能需要放开部分 JS/TS 配置文件的检查 |
