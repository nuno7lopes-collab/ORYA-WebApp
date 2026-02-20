#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const ROUTE_FILE_PATTERN = /\/route\.(ts|tsx|js|jsx)$/;
const IMPORT_LINE = 'import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";';

const PRE_VERIFICATION_ALLOWLIST = new Set([
  "app/api/auth/bootstrap/route.ts",
  "app/api/auth/me/route.ts",
  "app/api/email/verified/route.ts",
]);

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function resolvePolicy(relativePath) {
  if (PRE_VERIFICATION_ALLOWLIST.has(relativePath)) return "required_unverified_ok";
  if (relativePath.startsWith("app/api/public/")) return "optional_verified";
  return "required_verified";
}

function ensureImport(source) {
  if (source.includes(IMPORT_LINE)) return source;

  const importRegex = /^import\s.+;\s*$/gm;
  const matches = [...source.matchAll(importRegex)];
  if (matches.length === 0) {
    return `${IMPORT_LINE}\n\n${source}`;
  }

  const lastImport = matches[matches.length - 1];
  const insertionIndex = (lastImport.index ?? 0) + lastImport[0].length;
  return `${source.slice(0, insertionIndex)}\n${IMPORT_LINE}${source.slice(insertionIndex)}`;
}

function parseArgs(argv) {
  const args = {
    check: false,
    reportPath: path.join(ROOT, "reports", "auth_verified_migration_report.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      continue;
    }
    if (arg === "--report") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error("--report requer caminho");
      }
      args.reportPath = path.isAbsolute(nextValue) ? nextValue : path.join(ROOT, nextValue);
      index += 1;
      continue;
    }
    throw new Error(`Argumento não suportado: ${arg}`);
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const routeFiles = listFiles(API_ROOT).filter((filePath) => ROUTE_FILE_PATTERN.test(filePath));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.check ? "check" : "write",
    totalRouteFiles: routeFiles.length,
    filesWithRawGetUserBefore: 0,
    transformedFiles: [],
    unchangedFiles: [],
    unresolvedRawGetUser: [],
    policyByFile: {},
    preVerificationAllowlist: Array.from(PRE_VERIFICATION_ALLOWLIST).sort(),
  };

  for (const filePath of routeFiles) {
    const relativePath = toPosix(path.relative(ROOT, filePath));
    const original = fs.readFileSync(filePath, "utf8");
    if (!original.includes("supabase.auth.getUser(")) continue;

    report.filesWithRawGetUserBefore += 1;
    const policy = resolvePolicy(relativePath);
    report.policyByFile[relativePath] = policy;

    let updated = original.replaceAll(
      "supabase.auth.getUser()",
      `getUserWithPolicy(\"${policy}\", { supabaseOverride: supabase })`,
    );

    if (updated !== original) {
      updated = ensureImport(updated);
    }

    if (updated !== original) {
      report.transformedFiles.push(relativePath);
      if (!args.check) {
        fs.writeFileSync(filePath, updated, "utf8");
      }
    } else {
      report.unchangedFiles.push(relativePath);
    }

    if (updated.includes("supabase.auth.getUser(")) {
      report.unresolvedRawGetUser.push(relativePath);
    }
  }

  report.transformedFiles.sort();
  report.unchangedFiles.sort();
  report.unresolvedRawGetUser.sort();

  const reportDir = path.dirname(args.reportPath);
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (report.unresolvedRawGetUser.length > 0) {
    console.error("[auth-codemod] ficaram usos diretos de supabase.auth.getUser():");
    for (const file of report.unresolvedRawGetUser) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }

  console.log(
    `[auth-codemod] ${args.check ? "check" : "write"} concluído. ` +
      `ficheiros com substituição: ${report.transformedFiles.length}. ` +
      `relatório: ${toPosix(path.relative(ROOT, args.reportPath))}`,
  );
}

main();
