# Build & Lint 统一方案

> 目标：`package.json` 的 `scripts` 里**不再出现任何参数和路径**。单一入口 `jue-cli`，脚本层采用**注册扩展模式**，新增场景只需新增文件，不改核心路由。

---

## 一、核心设计

### 1.1 命令行极简

理想状态：

```json
{
  "scripts": {
    "build": "jue-cli",
    "typecheck": "jue-cli"
  },
  "jueCli": [
    { "phase": "build", "mode": "library", "platform": "node" },
    { "phase": "typecheck", "mode": "tsc" }
  ]
}
```

`jue-cli` 通过 `process.argv[2]` 或 `npm_lifecycle_event` 获取当前 phase（如 `build`、`typecheck`），然后在 `jueCli` 数组中找匹配项，按 `mode` 分发到对应文件执行。

### 1.2 全局 bin

根目录 `package.json` 注册一个 bin：

```json
{
  "name": "jue-workspace",
  "bin": {
    "jue-cli": "scripts/bin/jue-cli.ts"
  }
}
```

pnpm workspace 会把根目录的 bin 链接到所有子 package 的 `node_modules/.bin/`，因此任何子 package 的 `scripts` 里都可以直接写 `jue-cli`。

Wrapper 文件：

```ts
#!/usr/bin/env tsx
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../cli.ts", import.meta.url));
process.argv = [process.argv[0], cliPath, ...process.argv.slice(2)];
await import(cliPath);
```

---

## 二、脚本层设计：注册扩展模式

核心原则：**`cli.ts` 本身不写任何具体逻辑，只负责解析 phase、扫描注册表、读取配置、分发执行。**

### 2.1 目录结构

```
scripts/
  bin/
    jue-cli.ts          # bin wrapper，ts + tsx
  cli.ts                # 核心路由器：解析 phase → 扫描 cli-modes/ → 分发
  cli-modes/            # 平铺，不分 build/lint 目录
    library.ts          # library build（esbuild + tsc dts）
    vite.ts             # vite build
    custom.ts           # 自定义 shell 命令
    workspace.ts        # workspace 批量 build（封装 --filter）
    tsc.ts              # tsc --noEmit typecheck
    eslint.ts           # eslint
```

### 2.2 cli.ts 核心逻辑

```ts
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const phase = process.argv[2] || process.env.npm_lifecycle_event;
if (!phase) {
  console.error("Usage: jue-cli <phase>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const jueCli: any[] = pkg.jueCli || [];
const tasks = jueCli.filter((t) => t.phase === phase);

if (tasks.length === 0) {
  throw new Error(`No jueCli task for phase: "${phase}"`);
}

const modesDir = resolve(__dirname, "cli-modes");
const modes = new Map<string, (config: any) => Promise<void>>();

for (const file of readdirSync(modesDir)) {
  if (!file.endsWith(".ts")) continue;
  const modeName = basename(file, extname(file));
  const module = await import(resolve(modesDir, file));
  if (typeof module.run === "function") {
    modes.set(modeName, module.run);
  }
}

for (const task of tasks) {
  if (!task.mode) {
    throw new Error(`jueCli task for phase "${phase}" missing "mode"`);
  }
  const handler = modes.get(task.mode);
  if (!handler) {
    throw new Error(
      `Unknown mode: "${task.mode}". Available: ${[...modes.keys()].join(", ")}`,
    );
  }
  await handler(task);
}
```

### 2.3 一个 mode 的实现示例

所有 mode 文件统一导出 `run` 函数：

```ts
// scripts/cli-modes/library.ts
import { execSync } from "node:child_process";
import * as esbuild from "esbuild";

export async function run(cfg: any): Promise<void> {
  // 1. 清理
  // 2. esbuild bundle
  // 3. tsc emit declarations
  // 所有参数从 cfg 和当前目录的 package.json 读取
}
```

```ts
// scripts/cli-modes/workspace.ts
import { execSync } from "node:child_process";

export async function run(cfg: any): Promise<void> {
  execSync('pnpm -r --filter "./packages/*/*" run build', {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  if (cfg.post) {
    execSync(cfg.post, { stdio: "inherit", cwd: process.cwd() });
  }
}
```

### 2.4 扩展约定

新增一种模式：
1. 在 `scripts/cli-modes/` 下新建 `xxx.ts`
2. 导出 `export async function run(cfg: any): Promise<void>`
3. 在包的 `package.json` 里配 `"jueCli": [{ "phase": "...", "mode": "xxx" }]`
4. **不需要改 `cli.ts`**

---

## 三、预设模式清单

| mode | 文件 | 说明 | 使用者 |
|------|------|------|--------|
| `library` | `cli-modes/library.ts` | esbuild bundle JS + tsc emit `.d.ts` | 15 个 library 包 |
| `vite` | `cli-modes/vite.ts` | `vite build`，可选 `preBuild` | jue-current-app |
| `custom` | `cli-modes/custom.ts` | 执行 `command` 字段 | web-playground、非标脚本 |
| `workspace` | `cli-modes/workspace.ts` | `pnpm -r --filter` 批量 build，可选 `post` | 根目录 |
| `tsc` | `cli-modes/tsc.ts` | `tsc -p <tsconfig> --noEmit` | 大多数包 typecheck |
| `eslint` | `cli-modes/eslint.ts` | `eslint .` | 根目录 lint |

---

## 四、配置字段

`jueCli` 是**数组**，每个元素：

| 字段 | 必填 | 说明 |
|------|------|------|
| `phase` | ✅ | 匹配 `npm_lifecycle_event` 或 `jue-cli <phase>` 参数 |
| `mode` | ✅ | 决定调用哪个 `cli-modes/<mode>.ts` |

其余字段由具体 mode 消费：

| 字段 | 适用 mode | 说明 |
|------|----------|------|
| `platform` | `library` | `node` / `browser` / `neutral` |
| `format` | `library` | `esm` / `cjs` |
| `minify` | `library` | `string[]` / `false` |
| `extraEntries` | `library` | `string[]`，不在 `exports` 中的额外入口 |
| `preBuild` | `vite` | build 前执行的命令 |
| `viteConfig` | `vite` | 默认 `vite.config.ts` |
| `command` | `custom` | 自定义 shell 命令 |
| `post` | `workspace` | workspace build 完成后执行的命令 |
| `tsconfig` | `tsc` | 默认 `tsconfig.json` |
| `pretty` | `tsc` | 默认 `true` |

---

## 五、各包完整配置

### Library 包（15 个，模板）

```json
{
  "scripts": {
    "build": "jue-cli",
    "typecheck": "jue-cli"
  },
  "jueCli": [
    { "phase": "build", "mode": "library", "platform": "node", "minify": false },
    { "phase": "typecheck", "mode": "tsc" }
  ]
}
```

> 实际 `platform`、`minify` 按各包现有 `jueBuild` 配置填写。

### jue-current-app

```json
{
  "scripts": {
    "compile": "tsx scripts/compile.ts",
    "dev": "pnpm run compile && vite",
    "build": "jue-cli",
    "preview": "pnpm run build && vite preview",
    "typecheck": "jue-cli"
  },
  "jueCli": [
    { "phase": "build", "mode": "vite", "preBuild": "pnpm run compile" },
    { "phase": "typecheck", "mode": "tsc", "pretty": false }
  ]
}
```

### jue-mobile-showcase

```json
{
  "scripts": {
    "compile:web": "tsx scripts/compile-browser.ts",
    "compile:mp": "pnpm --dir ../../.. --filter @jue/skyline run build && tsx scripts/generate-miniprogram.ts",
    "compile": "pnpm run compile:web && pnpm run compile:mp",
    "dev:web": "pnpm run compile:web && vite --config vite.config.ts",
    "build:web": "jue-cli",
    "lint:generated": "tsx scripts/check-generated.ts && tsc -p tsconfig.generated.json --noEmit --pretty false",
    "typecheck": "jue-cli"
  },
  "jueCli": [
    { "phase": "build:web", "mode": "vite", "preBuild": "pnpm run compile:web" },
    { "phase": "typecheck", "mode": "tsc", "pretty": false }
  ]
}
```

> `lint:generated` 是非标脚本，维持现状，不走 `jue-cli`。

### web-playground

```json
{
  "scripts": {
    "build": "jue-cli",
    "preview": "pnpm run build && pnpm exec tsx ./scripts/serve-built-example-apps.ts",
    "typecheck": "jue-cli",
    "test:e2e": "pnpm run build && playwright test"
  },
  "jueCli": [
    { "phase": "build", "mode": "custom", "command": "pnpm exec tsx ../../../scripts/compile-example-components.ts && pnpm exec tsx ./scripts/build-example-apps.ts" },
    { "phase": "typecheck", "mode": "tsc" }
  ]
}
```

### 根目录

```json
{
  "scripts": {
    "build": "jue-cli",
    "lint": "jue-cli",
    "typecheck": "jue-cli",
    "compile:components": "pnpm exec tsx ./scripts/compile-example-components.ts",
    "build:examples": "pnpm --filter @jue/web-playground build",
    "docs": "pnpm --filter @jue/docsgen docsgen",
    "test": "node ./node_modules/vitest/vitest.mjs run",
    "test:e2e": "pnpm --filter @jue/web-playground test:e2e",
    "dev": "pnpm --filter @jue/web-playground preview",
    "bench": "pnpm --filter @jue/lab bench"
  },
  "jueCli": [
    { "phase": "build", "mode": "workspace", "post": "pnpm build:examples" },
    { "phase": "lint", "mode": "eslint" },
    { "phase": "typecheck", "mode": "tsc", "tsconfig": "tsconfig.check.json", "pretty": false }
  ]
}
```

---

## 六、改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `scripts/bin/jue-cli.ts` | bin wrapper，shebang `tsx`，argv 转发 |
| `scripts/cli.ts` | 核心路由器，扫描 `cli-modes/` 自动注册 |
| `scripts/cli-modes/library.ts` | library build（从 `build-package.ts` 迁移） |
| `scripts/cli-modes/vite.ts` | vite build |
| `scripts/cli-modes/custom.ts` | 自定义 shell 命令 |
| `scripts/cli-modes/workspace.ts` | workspace 批量 build（封装 filter） |
| `scripts/cli-modes/tsc.ts` | tsc typecheck |
| `scripts/cli-modes/eslint.ts` | eslint |

### 删除文件

| 文件 | 说明 |
|------|------|
| `scripts/build-package.ts` | 逻辑已迁移到 `cli-modes/library.ts` |

### 修改文件

| 文件 | 改动 |
|------|------|
| `package.json`（根目录） | 新增 `bin` 字段注册 `jue-cli`，新增 `jueCli` 数组 |
| 15 个 library `package.json` | `scripts.build` / `scripts.typecheck` 改为 `"jue-cli"`，新增 `jueCli` 数组 |
| 3 个 examples `package.json` | 按上面的配置示例调整 scripts 和 `jueCli` |

---

## 七、关键收益

1. **命令行零参数**：`"build": "jue-cli"` 比 `"tsx ../../../scripts/build-package.ts"` 干净得多
2. **单一入口**：build / lint / typecheck 全部走 `jue-cli`，不再分两个 bin
3. **新增模式零改动核心**：加 `cli-modes/xxx.ts` → 配 `jueCli` 数组项，`cli.ts` 一行不改
4. **模式即文件**：看到 `"mode": "library"`，立刻知道逻辑在 `scripts/cli-modes/library.ts`
5. **测试友好**：每个 mode 是独立模块，可以单独 unit test
6. **配置是数组**：一个包可以在不同 phase 复用不同 mode，扩展自然
