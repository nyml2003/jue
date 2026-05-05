/**
 * Build mode: library
 *
 * esbuild bundle JS + tsc emit .d.ts
 * Supports platform, minify, extraEntries from jueCli task config.
 */

import { execSync } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as esbuild from "esbuild";

interface LibraryBuildConfig {
  platform?: "node" | "browser" | "neutral";
  minify?: string[] | false;
  extraEntries?: string[];
}

export async function run(cfg: LibraryBuildConfig): Promise<void> {
  const cwd = process.cwd();
  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  const platform = cfg.platform || "neutral";
  const externals = deriveExternals(pkg, cwd, platform);
  const entries = deriveEntries(pkg, cfg.extraEntries || []);
  const minifySet = new Set(
    cfg.minify === false ? [] : (cfg.minify ?? ["index"]),
  );

  const pkgShortName = String(pkg.name).replace("@jue/", "");
  const distDir = resolve(cwd, "dist");
  const cacheDir = resolve(
    cwd,
    "../../../node_modules/.cache/jue",
    pkgShortName,
  );

  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }

  for (const entry of entries) {
    await esbuild.build({
      entryPoints: [resolve(cwd, entry.src)],
      bundle: true,
      format: "esm",
      platform,
      target: "esnext",
      outfile: resolve(cwd, entry.out),
      sourcemap: true,
      external: externals,
    });

    if (minifySet.has(entry.name)) {
      const minOut = entry.out.replace(/\.(js|mjs)$/, ".min.$1");
      await esbuild.build({
        entryPoints: [resolve(cwd, entry.src)],
        bundle: true,
        format: "esm",
        platform,
        target: "esnext",
        outfile: resolve(cwd, minOut),
        sourcemap: true,
        external: externals,
        minify: true,
      });
    }
  }

  execSync("tsc -p tsconfig.build.json --emitDeclarationOnly --outDir dist", {
    stdio: "inherit",
    cwd,
  });
}

function deriveEntries(
  pkg: Record<string, any>,
  extraEntries: string[],
): Array<{ name: string; src: string; out: string }> {
  const entries: Array<{ name: string; src: string; out: string }> = [];
  const exports = pkg.exports || {};

  for (const [key, val] of Object.entries(exports)) {
    if (typeof val !== "object" || val == null) continue;

    const v = val as Record<string, string>;
    const outRef = v.import ?? v.default ?? v.require;
    if (!outRef) continue;

    const outRel = outRef.replace(/^\.\//, "");
    const name = key === "." ? "index" : key.replace(/^\.\//, "");

    const outFile = outRel.replace(/^dist\//, "");
    const srcFile = outFile
      .replace(/\.mjs$/, ".ts")
      .replace(/\.js$/, ".ts");
    const srcRel = "src/" + srcFile;

    entries.push({ name, src: srcRel, out: outRel });
  }

  for (const extra of extraEntries) {
    const base = extra
      .replace(/^src\//, "")
      .replace(/\.ts$/, "");
    const outRel = `dist/${base}.js`;
    entries.push({ name: base, src: extra, out: outRel });
  }

  return entries;
}

function deriveExternals(
  pkg: Record<string, any>,
  cwd: string,
  platform: string,
): string[] {
  const externals = new Set<string>();
  const deps = Object.keys(pkg.dependencies || {});
  const jueDeps = deps.filter((d) => d.startsWith("@jue/"));

  if (platform === "node") {
    // Node 平台：所有 dependencies 都 externalize，避免 CJS/ESM 混合问题
    for (const dep of deps) {
      externals.add(dep);
    }
  } else {
    // Browser / neutral 平台：只 externalize @jue/ workspace 依赖
    for (const dep of jueDeps) {
      externals.add(dep);
    }
  }

  // 为 @jue/ 依赖添加 subpath exports
  for (const dep of jueDeps) {
    const depPkgPath = resolve(cwd, "node_modules", dep, "package.json");
    if (!existsSync(depPkgPath)) continue;

    try {
      const depPkg = JSON.parse(readFileSync(depPkgPath, "utf-8"));
      const depExports = depPkg.exports || {};
      for (const key of Object.keys(depExports)) {
        if (key === ".") continue;
        const subpath = key.replace(/^\.\//, "");
        externals.add(`${dep}/${subpath}`);
      }
    } catch {
      // ignore malformed package.json
    }
  }

  return Array.from(externals);
}
