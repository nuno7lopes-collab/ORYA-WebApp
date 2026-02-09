/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
  moduleTypes: {
    "**/packages/shared/src/**/*.ts": "cjs",
    "**/packages/shared/**/*.ts": "cjs",
  },
});

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.cjs <script.ts> [args...]");
  process.exit(1);
}

const targetPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
require(targetPath);
