#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "scripts", "manifests", "operational_scripts_allowlist_v1.json");
const CATALOG_PATH = path.join(ROOT, "scripts", "manifests", "operational_scripts_catalog_v1.json");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const SCRIPT_EXT_RE = /\.(?:mjs|cjs|js|ts|sh)$/;

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} em falta: ${path.relative(ROOT, filePath)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} invalido (${error instanceof Error ? error.message : String(error)})`);
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return Array.from(dup).sort();
}

function splitRunbookRef(reference) {
  const [runbookPath, anchor = ""] = String(reference).split("#", 2);
  return { runbookPath, anchor };
}

function assertString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function main() {
  const allowlist = loadJson(ALLOWLIST_PATH, "Allowlist operacional");
  const catalog = loadJson(CATALOG_PATH, "Catalogo operacional");
  const packageJson = loadJson(PACKAGE_PATH, "package.json");

  const errors = [];

  if (catalog?.version !== 1) {
    errors.push("catalog.version tem de ser 1");
  }

  const allowlistByEnv = allowlist?.scriptsByEnvironment;
  if (!allowlistByEnv || typeof allowlistByEnv !== "object" || Array.isArray(allowlistByEnv)) {
    errors.push("allowlist.scriptsByEnvironment invalido");
  }

  const allowlistEnvByScript = new Map();
  for (const [env, scripts] of Object.entries(allowlistByEnv ?? {})) {
    if (!Array.isArray(scripts)) continue;
    for (const scriptPath of scripts) {
      const envs = allowlistEnvByScript.get(scriptPath) ?? new Set();
      envs.add(env);
      allowlistEnvByScript.set(scriptPath, envs);
    }
  }
  const allowlistedScripts = new Set(allowlistEnvByScript.keys());

  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  if (entries.length === 0) {
    errors.push("catalog.entries esta vazio");
  }

  const entryScripts = entries.map((entry) => entry?.script).filter((value) => typeof value === "string");
  const duplicatedScripts = duplicates(entryScripts);
  if (duplicatedScripts.length > 0) {
    errors.push(`scripts duplicados no catalogo: ${duplicatedScripts.join(", ")}`);
  }

  const pkgScripts = packageJson?.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};
  const runbookCache = new Map();
  const catalogScripts = new Set();

  for (const entry of entries) {
    const scriptPath = entry?.script;
    if (!assertString(scriptPath)) {
      errors.push("entrada sem script valido");
      continue;
    }

    catalogScripts.add(scriptPath);

    if (!scriptPath.startsWith("scripts/") || !SCRIPT_EXT_RE.test(scriptPath)) {
      errors.push(`${scriptPath}: caminho/extensao invalidos`);
    }

    if (!allowlistedScripts.has(scriptPath)) {
      errors.push(`${scriptPath}: nao esta na allowlist operacional`);
    }

    if (!fs.existsSync(path.join(ROOT, scriptPath))) {
      errors.push(`${scriptPath}: ficheiro nao existe`);
    }

    if (!assertString(entry?.owner)) {
      errors.push(`${scriptPath}: owner em falta`);
    }

    if (!assertString(entry?.npmCommand)) {
      errors.push(`${scriptPath}: npmCommand em falta`);
    } else {
      const npmCommand = entry.npmCommand;
      const command = pkgScripts[npmCommand];
      if (!assertString(command)) {
        errors.push(`${scriptPath}: npmCommand inexistente (${npmCommand})`);
      } else if (!String(command).includes(scriptPath)) {
        errors.push(`${scriptPath}: npmCommand ${npmCommand} nao referencia diretamente o script`);
      }
    }

    if (!assertString(entry?.runbook)) {
      errors.push(`${scriptPath}: runbook em falta`);
    } else {
      const { runbookPath, anchor } = splitRunbookRef(entry.runbook);
      if (!assertString(runbookPath)) {
        errors.push(`${scriptPath}: runbook path invalido`);
      } else {
        const absRunbook = path.join(ROOT, runbookPath);
        if (!fs.existsSync(absRunbook)) {
          errors.push(`${scriptPath}: runbook nao existe (${runbookPath})`);
        } else {
          const content = runbookCache.get(absRunbook) ?? fs.readFileSync(absRunbook, "utf8");
          runbookCache.set(absRunbook, content);
          if (assertString(anchor) && !content.includes(`### ${anchor}`)) {
            errors.push(`${scriptPath}: ancora de runbook nao encontrada (${entry.runbook})`);
          }
        }
      }
    }

    const expectedEnvs = uniqueSorted(Array.from(allowlistEnvByScript.get(scriptPath) ?? []));
    const declaredEnvs = Array.isArray(entry?.environments)
      ? uniqueSorted(entry.environments.filter((env) => typeof env === "string"))
      : [];

    if (expectedEnvs.join("|") !== declaredEnvs.join("|")) {
      errors.push(
        `${scriptPath}: environments divergentes (esperado=${expectedEnvs.join(",")} catalog=${declaredEnvs.join(",")})`,
      );
    }

    if (entry?.status !== "active") {
      errors.push(`${scriptPath}: status invalido (esperado=active)`);
    }
  }

  const missingInCatalog = uniqueSorted(
    Array.from(allowlistedScripts).filter((scriptPath) => !catalogScripts.has(scriptPath)),
  );
  if (missingInCatalog.length > 0) {
    errors.push(`scripts da allowlist sem catalogo: ${missingInCatalog.join(", ")}`);
  }

  const extraInCatalog = uniqueSorted(
    Array.from(catalogScripts).filter((scriptPath) => !allowlistedScripts.has(scriptPath)),
  );
  if (extraInCatalog.length > 0) {
    errors.push(`scripts no catalogo fora da allowlist: ${extraInCatalog.join(", ")}`);
  }

  if (errors.length > 0) {
    console.error("Operational scripts catalog gate falhou:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const owners = new Set(entries.map((entry) => entry.owner));
  console.log(
    `Operational scripts catalog gate: OK (${entries.length} entradas | ${owners.size} owners | allowlist:${allowlistedScripts.size})`,
  );
}

main();
