#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_SNAPSHOT = "tests/ui/surface-inventory/surface-inventory.snapshot.json";

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else {
        out.push(absolute);
      }
    }
  }
  return out;
}

function toRepoRelative(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

function isUserFacingUserPath(webPath) {
  const prefixes = [
    "app/me/",
    "app/login",
    "app/signup",
    "app/reset-password",
    "app/onboarding/",
    "app/network",
    "app/rede",
    "app/atividade",
    "app/auth/",
  ];
  return prefixes.some((prefix) => webPath.startsWith(prefix));
}

function classifyWebPage(webPath) {
  if (webPath.startsWith("app/org/_internal/")) return "legacy_compat";
  if (webPath.startsWith("app/org/[orgId]/")) return "org";
  if (webPath.startsWith("app/admin/")) return "admin";
  if (isUserFacingUserPath(webPath)) return "user";
  return "public";
}

function collectInventory() {
  const webPages = walkFiles(path.join(ROOT, "app"))
    .map(toRepoRelative)
    .filter((pathname) => pathname.endsWith("/page.tsx"))
    .sort();

  const mobileScreens = walkFiles(path.join(ROOT, "apps/mobile/app"))
    .map(toRepoRelative)
    .filter((pathname) => pathname.endsWith(".tsx"))
    .sort();

  const classified = {
    org: [],
    admin: [],
    user: [],
    public: [],
    legacy_compat: [],
  };

  for (const page of webPages) {
    const key = classifyWebPage(page);
    classified[key].push(page);
  }

  const inventory = {
    version: 1,
    webPages,
    mobileScreens,
    classified,
    counts: {
      webTotal: webPages.length,
      mobileTotal: mobileScreens.length,
      org: classified.org.length,
      admin: classified.admin.length,
      user: classified.user.length,
      public: classified.public.length,
      legacyCompat: classified.legacy_compat.length,
    },
  };

  return inventory;
}

function parseArgs(argv) {
  const out = {
    write: false,
    check: false,
    file: DEFAULT_SNAPSHOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") {
      out.write = true;
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        out.file = argv[i + 1];
        i += 1;
      }
      continue;
    }
    if (arg === "--check") {
      out.check = true;
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        out.file = argv[i + 1];
        i += 1;
      }
    }
  }

  return out;
}

function stableJson(input) {
  return `${JSON.stringify(input, null, 2)}\n`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const inventory = collectInventory();

  if (args.write) {
    const absolute = path.resolve(ROOT, args.file);
    ensureDir(absolute);
    fs.writeFileSync(absolute, stableJson(inventory), "utf8");
    process.stdout.write(`[uiux_surface_inventory] snapshot written: ${args.file}\n`);
    return;
  }

  if (args.check) {
    const absolute = path.resolve(ROOT, args.file);
    if (!fs.existsSync(absolute)) {
      process.stderr.write(`[uiux_surface_inventory] missing snapshot: ${args.file}\n`);
      process.stderr.write(
        `[uiux_surface_inventory] run: node scripts/uiux_surface_inventory.mjs --write ${args.file}\n`,
      );
      process.exit(1);
    }

    const expected = fs.readFileSync(absolute, "utf8");
    const current = stableJson(inventory);
    if (expected !== current) {
      process.stderr.write("[uiux_surface_inventory] snapshot drift detected\n");
      process.stderr.write(`[uiux_surface_inventory] run: node scripts/uiux_surface_inventory.mjs --write ${args.file}\n`);
      process.exit(1);
    }

    process.stdout.write("[uiux_surface_inventory] snapshot OK\n");
    return;
  }

  process.stdout.write(stableJson(inventory));
}

run();
