import { generateCoreSpecSnippet, generateExampleRegistrySnippet, generateSupportMatrix } from "./index";

async function main() {
  const output = [
    await generateSupportMatrix(),
    "",
    await generateExampleRegistrySnippet(),
    "",
    await generateCoreSpecSnippet()
  ].join("\n");

  console.log(output);
}

void main();
