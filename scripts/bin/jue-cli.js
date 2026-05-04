const { spawnSync } = require("child_process");
const { resolve } = require("path");

const cliTs = resolve(__dirname, "../cli.ts");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", cliTs, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() }
);
process.exit(result.status ?? 0);
