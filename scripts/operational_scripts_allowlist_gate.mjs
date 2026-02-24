#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "scripts", "manifests", "operational_scripts_allowlist_v1.json");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const KNOWN_ENVS = ["local", "dev", "ci", "prod"];
const SCRIPT_EXT_RE = /\.(?:mjs|cjs|js|ts|sh)$/;
const SCRIPT_REF_RE = /(?:\.\/)?(scripts\/[\w./-]+\.(?:mjs|cjs|js|ts|sh))/g;

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} em falta: ${path.relative(ROOT, filePath)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} inválido (${error instanceof Error ? error.message : String(error)})`);
  }
}

function countDuplicates(items) {
  const counter = new Map();
  for (const item of items) {
    counter.set(item, (counter.get(item) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function extractPackageScriptPaths(packageJson) {
  const found = new Set();
  const scripts = packageJson?.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};

  for (const command of Object.values(scripts)) {
    const text = String(command);
    for (const match of text.matchAll(SCRIPT_REF_RE)) {
      found.add(match[1]);
    }
  }

  return found;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function main() {
  const manifest = loadJson(MANIFEST_PATH, "Manifesto de allowlist operacional");
  const packageJson = loadJson(PACKAGE_PATH, "package.json");

  const errors = [];

  if (manifest?.version !== 1) {
    errors.push("manifest.version tem de ser 1");
  }

  const manifestEnvs = Array.isArray(manifest?.environments) ? uniqueSorted(manifest.environments) : [];
  const expectedEnvs = uniqueSorted(KNOWN_ENVS);
  if (manifestEnvs.join("|") !== expectedEnvs.join("|")) {
    errors.push(`manifest.environments inválido (esperado: ${expectedEnvs.join(", ")})`);
  }

  const scriptsByEnvironment = manifest?.scriptsByEnvironment;
  if (!scriptsByEnvironment || typeof scriptsByEnvironment !== "object" || Array.isArray(scriptsByEnvironment)) {
    errors.push("manifest.scriptsByEnvironment tem de ser objeto");
  }

  const unknownEnvKeys = Object.keys(scriptsByEnvironment ?? {}).filter((env) => !KNOWN_ENVS.includes(env));
  if (unknownEnvKeys.length > 0) {
    errors.push(`ambientes desconhecidos em scriptsByEnvironment: ${unknownEnvKeys.join(", ")}`);
  }

  const missingEnvKeys = KNOWN_ENVS.filter((env) => !Object.prototype.hasOwnProperty.call(scriptsByEnvironment ?? {}, env));
  if (missingEnvKeys.length > 0) {
    errors.push(`ambientes em falta em scriptsByEnvironment: ${missingEnvKeys.join(", ")}`);
  }

  const allowlistedScripts = new Set();

  for (const env of KNOWN_ENVS) {
    const entries = scriptsByEnvironment?.[env];
    if (!Array.isArray(entries)) {
      errors.push(`${env}: lista inexistente ou inválida`);
      continue;
    }

    const duplicates = countDuplicates(entries);
    if (duplicates.length > 0) {
      errors.push(`${env}: entradas duplicadas (${duplicates.join(", ")})`);
    }

    for (const scriptPath of entries) {
      if (typeof scriptPath !== "string") {
        errors.push(`${env}: entrada não textual detetada`);
        continue;
      }

      if (!scriptPath.startsWith("scripts/")) {
        errors.push(`${env}: caminho fora de scripts/ (${scriptPath})`);
      }

      if (!SCRIPT_EXT_RE.test(scriptPath)) {
        errors.push(`${env}: extensão não suportada (${scriptPath})`);
      }

      const abs = path.join(ROOT, scriptPath);
      if (!fs.existsSync(abs)) {
        errors.push(`${env}: script inexistente (${scriptPath})`);
      }

      allowlistedScripts.add(scriptPath);
    }
  }

  const discovery = manifest?.discovery ?? {};
  const includePackageScripts = Boolean(discovery?.includePackageScripts);
  const extraOperationalPaths = Array.isArray(discovery?.extraOperationalPaths)
    ? uniqueSorted(discovery.extraOperationalPaths)
    : [];

  const packageScriptPaths = includePackageScripts ? extractPackageScriptPaths(packageJson) : new Set();

  const expectedOperationalSet = new Set([...packageScriptPaths, ...extraOperationalPaths]);

  for (const scriptPath of expectedOperationalSet) {
    if (!SCRIPT_EXT_RE.test(scriptPath)) {
      errors.push(`discovery: extensão não suportada (${scriptPath})`);
      continue;
    }

    if (!scriptPath.startsWith("scripts/")) {
      errors.push(`discovery: caminho fora de scripts/ (${scriptPath})`);
      continue;
    }

    const abs = path.join(ROOT, scriptPath);
    if (!fs.existsSync(abs)) {
      errors.push(`discovery: ficheiro não existe (${scriptPath})`);
    }
  }

  const missingFromAllowlist = uniqueSorted([...expectedOperationalSet].filter((p) => !allowlistedScripts.has(p)));
  if (missingFromAllowlist.length > 0) {
    errors.push(`scripts operacionais fora da allowlist: ${missingFromAllowlist.join(", ")}`);
  }

  if (errors.length > 0) {
    console.error("Operational scripts allowlist gate falhou:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const envCounts = KNOWN_ENVS.map((env) => `${env}:${scriptsByEnvironment[env].length}`).join(" | ");
  console.log(
    `Operational scripts allowlist gate: OK (${allowlistedScripts.size} scripts únicos | ${envCounts} | package:${packageScriptPaths.size} | extras:${extraOperationalPaths.length})`,
  );
}

main();
