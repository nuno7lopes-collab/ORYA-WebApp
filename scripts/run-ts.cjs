/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const Module = require("module");

const projectRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithAliases(request, parent, isMain, options) {
  if (typeof request === "string") {
    if (request === "server-only") {
      request = path.join(projectRoot, "scripts", "shims", "server-only.js");
    } else
    if (request === "@orya/shared") {
      request = path.join(projectRoot, "packages", "shared", "src", "index.ts");
    } else if (request.startsWith("@orya/shared/")) {
      request = path.join(projectRoot, "packages", "shared", "src", request.slice("@orya/shared/".length));
    } else if (request.startsWith("@/")) {
      request = path.join(projectRoot, request.slice(2));
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

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
