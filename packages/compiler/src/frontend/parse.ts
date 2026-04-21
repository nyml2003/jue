import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export function parseModule(source: string): File {
  return parse(source, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx"
    ]
  });
}
