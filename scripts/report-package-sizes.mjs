import { brotliCompressSync, gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const packagesRoot = new URL("../packages/", import.meta.url);
const packageNames = readdirSync(packagesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

const rows = [];

for (const packageName of packageNames) {
  const packageRoot = join(packagesRoot.pathname, packageName);
  const distRoot = join(packageRoot, "dist");

  let files = [];
  try {
    files = collectFiles(distRoot)
      .filter(file => file.endsWith(".js") || file.endsWith(".d.ts"))
      .sort();
  } catch {
    rows.push({
      packageName,
      file: "(missing dist)",
      raw: 0,
      gzip: 0,
      brotli: 0
    });
    continue;
  }

  for (const file of files) {
    const bytes = readFileSync(file);
    rows.push({
      packageName,
      file: relative(packageRoot, file).replaceAll("\\", "/"),
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
      brotli: brotliCompressSync(bytes).length
    });
  }
}

printRows(rows);

function collectFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function printRows(rows) {
  const header = ["package", "file", "raw", "gzip", "brotli"];
  const table = [
    header,
    ...rows.map(row => [
      row.packageName,
      row.file,
      formatBytes(row.raw),
      formatBytes(row.gzip),
      formatBytes(row.brotli)
    ])
  ];

  const widths = header.map((_, index) => Math.max(...table.map(row => row[index].length)));
  for (const row of table) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index])).join("  "));
  }

  console.log("");
  console.log("totals");

  for (const packageName of [...new Set(rows.map(row => row.packageName))]) {
    const packageRows = rows.filter(row => row.packageName === packageName);
    console.log(`${packageName.padEnd(12)} ${formatBytes(sum(packageRows, "raw")).padStart(9)} raw  ${formatBytes(sum(packageRows, "gzip")).padStart(9)} gzip  ${formatBytes(sum(packageRows, "brotli")).padStart(9)} brotli`);
  }
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(2)} kB`;
}
