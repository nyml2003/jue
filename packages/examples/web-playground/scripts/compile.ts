import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const appsRoot = join(process.cwd(), "apps");
const apps = readdirSync(appsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

for (const app of apps) {
  const input = join(appsRoot, app, "page.component.tsx");
  const output = join(appsRoot, app, "generated", "page.generated.ts");
  console.log(`Compiling ${input}...`);
  execSync(`pnpm exec jue-compile --input "${input}" --output "${output}"`, { stdio: "inherit" });
  execSync(`pnpm exec eslint --fix "${output}"`, { stdio: "inherit" });
}
