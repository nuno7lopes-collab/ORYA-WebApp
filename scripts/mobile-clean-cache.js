#!/usr/bin/env node

const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const mobileDir = path.join(rootDir, "apps", "mobile");
const homeDir = os.homedir();
const isAggressive = process.argv.includes("--aggressive");

const staticCachePaths = [
  path.join(mobileDir, ".expo"),
  path.join(mobileDir, ".expo-shared"),
  path.join(mobileDir, ".metro-cache"),
  path.join(mobileDir, "node_modules", ".cache", "metro"),
  path.join(rootDir, ".expo"),
  path.join(rootDir, ".expo-shared"),
];

const aggressiveCachePaths = [
  // Só em modo agressivo: estas localizações podem conter estado de sessão do Expo.
  path.join(homeDir, ".expo"),
  path.join(homeDir, ".expo-shared"),
  path.join(homeDir, "Library", "Caches", "expo"),
  path.join(homeDir, "Library", "Caches", "Expo"),
];

const tmpPrefixes = [
  "metro-",
  "metro-cache",
  "haste-map-",
  "react-native-packager-cache-",
  "react-native-packager-cache",
  "expo-start-",
];

const removePathIfExists = async (targetPath) => {
  if (!fsSync.existsSync(targetPath)) return false;
  await fs.rm(targetPath, { recursive: true, force: true });
  return true;
};

const clearWatchman = () => {
  const result = spawnSync("watchman", ["watch-del-all"], {
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.error) {
    return {
      ok: false,
      reason: "watchman não está disponível",
    };
  }
  if (result.status === 0) {
    return { ok: true, reason: "watchman limpo" };
  }
  return {
    ok: false,
    reason:
      (result.stderr || result.stdout || "watchman devolveu erro").trim(),
  };
};

const clearTmpCaches = async () => {
  const tmpDir = os.tmpdir();
  let removed = 0;
  let entries = [];
  try {
    entries = await fs.readdir(tmpDir, { withFileTypes: true });
  } catch {
    return removed;
  }
  for (const entry of entries) {
    const name = entry.name || "";
    if (!tmpPrefixes.some((prefix) => name.startsWith(prefix))) continue;
    const fullPath = path.join(tmpDir, name);
    await fs.rm(fullPath, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
};

const main = async () => {
  const targetPaths = isAggressive
    ? [...staticCachePaths, ...aggressiveCachePaths]
    : staticCachePaths;
  const removedPaths = [];
  for (const targetPath of targetPaths) {
    const removed = await removePathIfExists(targetPath);
    if (removed) removedPaths.push(targetPath);
  }

  const tmpRemoved = await clearTmpCaches();
  const watchman = clearWatchman();

  if (removedPaths.length > 0) {
    for (const targetPath of removedPaths) {
      console.log(`[mobile:cache:clean] removido: ${targetPath}`);
    }
  } else {
    console.log("[mobile:cache:clean] sem caches locais para remover");
  }
  console.log(`[mobile:cache:clean] tmp removidos: ${tmpRemoved}`);
  console.log(
    `[mobile:cache:clean] modo: ${isAggressive ? "agressivo" : "seguro (sem apagar sessão Expo)"}`,
  );
  console.log(
    `[mobile:cache:clean] watchman: ${watchman.ok ? "ok" : "skip"} (${watchman.reason})`,
  );
};

main().catch((error) => {
  console.error("[mobile:cache:clean] erro:", error);
  process.exitCode = 1;
});
