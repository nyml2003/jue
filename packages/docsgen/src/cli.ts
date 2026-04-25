import { generateCoreSpecSnippet, generateExampleRegistrySnippet, generatePhase2PackageMatrix } from "./index";

async function main() {
  const output = [
    await generatePhase2PackageMatrix(),
    "",
    await generateExampleRegistrySnippet(),
    "",
    await generateCoreSpecSnippet()
  ].join("\n");

  console.log(output);
}

void main();
