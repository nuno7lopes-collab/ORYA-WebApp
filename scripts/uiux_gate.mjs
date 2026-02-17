#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./load-env.js");

const steps = [
  {
    name: "surface inventory snapshot",
    cmd: "node",
    args: ["scripts/uiux_surface_inventory.mjs", "--check"],
  },
  {
    name: "critical web ui/e2e",
    cmd: "node",
    args: ["scripts/run-playwright-ui.mjs"],
  },
  {
    name: "mobile ui tests",
    cmd: "npm",
    args: ["--prefix", "apps/mobile", "test", "--", "--runInBand"],
  },
];

for (const step of steps) {
  process.stdout.write(`\n[gate:ui-ux] ${step.name}\n`);
  const result = spawnSync(step.cmd, step.args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.stderr.write(`\n[gate:ui-ux] FAIL at step: ${step.name}\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write("\n[gate:ui-ux] OK\n");
