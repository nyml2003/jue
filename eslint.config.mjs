import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "node_modules/**",
      ".omx/**",
      "examples/**/generated/**",
      "**/node_modules/**",
      "eslint.config.mjs",
      "vitest.config.ts",
      "**/vite.config.ts",
      "**/vite.config.js",
      "**/vite.config.js.map",
      "**/vite.config.d.ts",
      "**/vite.config.d.ts.map",
      "**/*.js",
      "**/*.mjs",
      "**/*.js.map",
      "**/*.d.ts",
      "**/*.d.ts.map"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.mts"
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.check.json",
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          "prefer": "type-imports"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    files: [
      "**/*.component.tsx"
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off"
    }
  }
];
