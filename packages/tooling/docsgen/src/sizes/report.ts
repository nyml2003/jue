import { brotliCompressSync, gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { collectFiles } from "./scanner.js";

export interface SizeRow {
  readonly packageName: string;
  readonly file: string;
  readonly raw: number;
  readonly gzip: number;
  readonly brotli: number;
}

export function buildSizeRows(packageName: string, packageRoot: string): SizeRow[] {
  const distRoot = join(packageRoot, "dist");
  const rows: SizeRow[] = [];

  let files: string[] = [];
  try {
    files = collectFiles(distRoot)
      .filter(file => file.endsWith(".js") || file.endsWith(".d.ts"))
      .sort();
  } catch {
    return [{
      packageName,
      file: "(missing dist)",
      raw: 0,
      gzip: 0,
      brotli: 0
    }];
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

  return rows;
}

export function printSizeReport(rows: SizeRow[]): void {
  printRows(rows);
  console.log("");
  printEntrySummary(rows);
  console.log("");
  printJsTotals(rows);
  console.log("");
  printLargestEntrypoints(rows);
}

function printRows(rows: SizeRow[]): void {
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

  const widths = header.map((_, index) => Math.max(...table.map(row => row[index]!.length)));
  for (const row of table) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index]!)).join("  "));
  }

  console.log("");
  console.log("totals");

  for (const packageName of [...new Set(rows.map(row => row.packageName))]) {
    const packageRows = rows.filter(row => row.packageName === packageName);
    console.log(`${packageName.padEnd(12)} ${formatBytes(sum(packageRows, "raw")).padStart(9)} raw  ${formatBytes(sum(packageRows, "gzip")).padStart(9)} gzip  ${formatBytes(sum(packageRows, "brotli")).padStart(9)} brotli`);
  }
}

function printEntrySummary(rows: SizeRow[]): void {
  console.log("entrypoints");

  const entryRows = rows
    .filter(row => row.file.endsWith("index.js") || row.file.endsWith("index.min.js"))
    .sort((left, right) => {
      if (left.packageName !== right.packageName) {
        return left.packageName.localeCompare(right.packageName);
      }
      return left.file.localeCompare(right.file);
    });

  const table = [
    ["package", "entry", "raw", "gzip", "brotli"],
    ...entryRows.map(row => [
      row.packageName,
      row.file.replace(/^dist\//, ""),
      formatBytes(row.raw),
      formatBytes(row.gzip),
      formatBytes(row.brotli)
    ])
  ];

  const widths = table[0]!.map((_, index) => Math.max(...table.map(row => row[index]!.length)));
  for (const row of table) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index]!)).join("  "));
  }
}

function printJsTotals(rows: SizeRow[]): void {
  console.log("js totals");

  for (const packageName of [...new Set(rows.map(row => row.packageName))]) {
    const packageRows = rows.filter(row => row.packageName === packageName && row.file.endsWith(".js"));
    console.log(`${packageName.padEnd(12)} ${formatBytes(sum(packageRows, "raw")).padStart(9)} raw  ${formatBytes(sum(packageRows, "gzip")).padStart(9)} gzip  ${formatBytes(sum(packageRows, "brotli")).padStart(9)} brotli`);
  }
}

function printLargestEntrypoints(rows: SizeRow[]): void {
  console.log("largest entrypoints");

  const entryRows = rows
    .filter(row => row.file.endsWith("index.min.js"))
    .sort((left, right) => right.gzip - left.gzip)
    .slice(0, 10);

  const table = [
    ["package", "entry", "raw", "gzip", "brotli"],
    ...entryRows.map(row => [
      row.packageName,
      row.file.replace(/^dist\//, ""),
      formatBytes(row.raw),
      formatBytes(row.gzip),
      formatBytes(row.brotli)
    ])
  ];

  const widths = table[0]!.map((_, index) => Math.max(...table.map(row => row[index]!.length)));
  for (const row of table) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index]!)).join("  "));
  }
}

function sum(rows: SizeRow[], key: "raw" | "gzip" | "brotli"): number {
  return rows.reduce((total, row) => total + (row[key] ?? 0), 0);
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  return `${(value / 1024).toFixed(2)} kB`;
}
