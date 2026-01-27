#!/usr/bin/env node
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const scriptPath = path.resolve(ROOT, "scripts/generate_cover_library.js");
const args = process.argv.slice(2);

const result = spawnSync("node", [scriptPath, ...args], { stdio: "inherit" });
process.exit(result.status === null ? 1 : result.status);
