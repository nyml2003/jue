# 构建系统问题修复方案

> 基于 `build-system-audit.md` 的梳理，给出可落地的修复计划。
> 按风险从低到高排序，可逐阶段执行。

---

## 阶段 1：清理 src/ 中的声明产物（零风险，立即可做）

### 1.1 删除意外生成的 untracked 文件

```bash
# packages/kernel/compiler/src/
rm packages/kernel/compiler/src/*.d.ts
rm packages/kernel/compiler/src/*.d.ts.map
rm packages/kernel/compiler/src/frontend/*.d.ts
rm packages/kernel/compiler/src/frontend/*.d.ts.map

# packages/kernel/runtime-core/src/
rm packages/kernel/runtime-core/src/*.d.ts
rm packages/kernel/runtime-core/src/*.d.ts.map
```

### 1.2 从 git 移除历史遗留的 tracked 声明文件

这些文件虽然被 git 跟踪，但 `build` 脚本已经能重新生成到 `dist/`，不应留在 `src/`：

```bash
git rm --cached packages/authoring/primitives/src/index.d.ts
 git rm --cached packages/authoring/primitives/src/index.d.ts.map
 git rm --cached packages/kernel/shared/src/host.d.ts
 git rm --cached packages/kernel/shared/src/index.d.ts
 git rm --cached packages/kernel/shared/src/opcode.d.ts
 git rm --cached packages/kernel/shared/src/result.d.ts
 git rm --cached packages/kernel/shared/src/host.d.ts.map
 git rm --cached packages/kernel/shared/src/index.d.ts.map
 # opcode.d.ts.map 和 result.d.ts.map 当前是 modified，也一并移除
 git rm --cached packages/kernel/shared/src/opcode.d.ts.map
 git rm --cached packages/kernel/shared/src/result.d.ts.map
```

### 1.3 加固 .gitignore

在 `.gitignore` 中新增规则，防止今后任何 `src/` 下再漏入生成产物：

```gitignore
# Generated declaration files should never live in src/
packages/**/src/*.d.ts
packages/**/src/*.d.ts.map
```

> 注意：`packages/authoring/jsx/src/jsx-runtime.d.ts` 是**手写**的，不应被忽略。但由于它叫 `jsx-runtime.d.ts`，上面的通配规则不会误伤它（规则匹配的是 `src/*.d.ts`，不是 `src/jsx-runtime.d.ts`... 等等，`src/*.d.ts` 会匹配 `src/jsx-runtime.d.ts`。所以上面的规则太粗了。）

更安全的写法：只匹配与 `.ts` 同名的 `.d.ts` 和 `.d.ts.map`。由于 gitignore 不支持这么复杂的逻辑，建议改为：

```gitignore
# Ignore generated .d.ts/.map in src, except hand-written ones
packages/kernel/*/src/*.d.ts
packages/kernel/*/src/*.d.ts.map
packages/authoring/primitives/src/*.d.ts
packages/authoring/primitives/src/*.d.ts.map
```

或者更简单：明确保留 `jsx-runtime.d.ts`，对其它 package 的 `src/*.d.ts` 一律忽略：

```gitignore
packages/**/src/*.d.ts
packages/**/src/*.d.ts.map
# Exception: hand-written JSX declaration
!packages/authoring/jsx/src/jsx-runtime.d.ts
```

### 1.4 验证

执行完上述步骤后，运行：

```bash
git status
pnpm build
```

确认：
- `git status` 中这些文件不再是 untracked/modified
- `pnpm build` 后产物正常输出到 `dist/`

---

## 阶段 2：拆分 build 脚本（低风险，高可读性收益）

### 问题
每个 library 的 `build` 是一行 500~1500 字符的 shell 链，难以阅读和维护。

### 方案 A：保守拆分（不改工具，只改结构）

把每个 package 的 `build` 拆成多个子脚本：

```json
{
  "scripts": {
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "build:clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true});require('fs').rmSync('../../../node_modules/.cache/jue/shared',{recursive:true,force:true})\"",
    "build:js": "esbuild src/index.ts --bundle --format=esm --platform=neutral --target=esnext --outfile=dist/index.js --sourcemap && esbuild src/index.ts --bundle --format=esm --platform=neutral --target=esnext --minify --outfile=dist/index.min.js",
    "build:types": "tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist"
  }
}
```

**优点**：改动最小，package.json 立刻可读。
**缺点**：`build:js` 仍然可能很长（如 compiler 有 6 个入口）。

### 方案 B：引入统一构建脚本（推荐）

写一个 `scripts/build-package.ts`，用 Node API 调用 esbuild + tsc。每个 package 的 `build` 变成：

```json
{
  "scripts": {
    "build": "tsx ../../scripts/build-package.ts"
  }
}
```

`build-package.ts` 的核心逻辑：
- 读取当前 package 的 `package.json` 中的自定义字段（如 `"jueBuild": { "entries": [...], "externals": [...] }`）
- 或用约定：自动遍历 `src/index.ts`、`src/frontend/index.ts` 等入口
- 自动执行 clean -> esbuild(bundle + minify) -> tsc(emitDeclarationOnly)

**优点**：所有 package 的 build 逻辑集中在一处，新增 package 时几乎不用写 build 脚本。
**缺点**：需要写一个约 100~200 行的构建脚本，并改造所有 package.json。

### 方案 C：引入 tsup（最轻量）

`tsup` 本质是对 esbuild 的封装，天然支持：
- 多入口
- 自动生成 `.d.ts`（用 tsc 或 rollup-dts）
- minify
- sourcemap

每个 package 的 `build` 可缩短为：

```json
{
  "scripts": {
    "build": "tsup src/index.ts src/frontend/index.ts --format=esm --dts --sourcemap --clean"
  }
}
```

**优点**：一行搞定，社区标准方案。
**缺点**：
- 当前 esbuild 参数比较精细（platform=neutral/browser/node 不同），tsup 不一定 1:1 支持所有现有行为
- 需要新增依赖
- 某些 package（如 compiler）有多个独立入口且输出路径有特定结构，需要验证 tsup 是否能完全覆盖

### 推荐选择

- **如果希望改动最小**：选 **方案 A**（拆分子脚本）。
- **如果希望长期维护成本最低**：选 **方案 B**（统一构建脚本）。
- **如果希望最社区化**：评估 **方案 C**（tsup），但需先验证多入口 + platform 差异的兼容性。

---

## 阶段 3：精简 tsconfig.build.json 中的重复 paths（中等复杂度）

### 问题
每个 `tsconfig.build.json` 都有一块 80 行的 `paths`，内容几乎完全相同，只是把 `src/index.ts` 换成了 `dist/index.d.ts`。

### 方案
把这块重复的 `paths` 抽到一个共享文件，比如 `tsconfig.build.paths.json`：

```json
{
  "compilerOptions": {
    "baseUrl": "../../../",
    "paths": {
      "@jue/shared": ["packages/kernel/shared/dist/index.d.ts"],
      "@jue/runtime-core": ["packages/kernel/runtime-core/dist/index.d.ts"],
      "@jue/compiler": ["packages/kernel/compiler/dist/index.d.ts"],
      "@jue/jsx": ["packages/authoring/jsx/dist/index.d.ts"],
      "...": "..."
    }
  }
}
```

然后每个 `tsconfig.build.json` 改为多重 extends：

```json
{
  "extends": ["./tsconfig.json", "../../../tsconfig.build.paths.json"],
  "compilerOptions": {
    "rootDir": "src",
    "tsBuildInfoFile": "../../../node_modules/.cache/jue/xxx/tsconfig.build.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

**注意**：tsconfig 的 `extends` 从 TS 5.0 开始支持数组，当前 `tsconfig.base.json` 的 `target` 是 `ES2022`，说明 TS 版本足够新（>= 4.5 即可），应该支持数组 extends。

**优点**：paths 只维护一份，新增 workspace 包时只需改一个地方。
**缺点**：需要确认当前 TypeScript 版本是否支持数组 extends（TS 5.0+）。

---

## 阶段 4：ESLint 扩展（可选，看需求）

### 问题
当前 ESLint 忽略所有 `.js`、`.mjs`、`.d.ts` 和配置文件。

### 如果未来需要检查配置文件

可以新增一个 overrides 块：

```js
{
  files: ["scripts/**/*.ts", "*.config.ts", "*.config.mjs"],
  rules: {
    "@typescript-eslint/no-unsafe-call": "off",
    // 配置文件通常可以更宽松
  }
}
```

但目前这不是阻塞性问题，可以按需再做。

---

## 执行建议

| 优先级 | 阶段 | 预估耗时 | 收益 |
|--------|------|----------|------|
| P0 | 阶段 1（清理产物 + .gitignore） | 5 分钟 | 消除 untracked 文件噪音，防止再次污染 |
| P1 | 阶段 2（build 脚本拆分/封装） | 30~60 分钟 | 大幅提升可维护性 |
| P2 | 阶段 3（tsconfig paths 共享） | 15~30 分钟 | 减少重复配置 |
| P3 | 阶段 4（ESLint 扩展） | 按需 | 提升配置文件质量 |

---

## 下一步

1. **先执行阶段 1**（清理），这是零风险且立竿见影的改进。
2. 然后选择 **阶段 2 的 A/B/C 方案** 之一推进。
3. 阶段 3 可以在阶段 2 完成后顺手做。
