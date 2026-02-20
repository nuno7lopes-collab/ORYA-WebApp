#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const API_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/;

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

function main() {
  const apiFiles = listFiles(API_ROOT).filter((filePath) => API_FILE_PATTERN.test(filePath));

  const rawGetUserViolations = [];
  const missingPreVerificationPolicy = [];
  const misplacedPreVerificationPolicy = [];

  for (const filePath of apiFiles) {
    const relativePath = toPosix(path.relative(ROOT, filePath));
    const source = fs.readFileSync(filePath, "utf8");

    if (source.includes("supabase.auth.getUser(")) {
      rawGetUserViolations.push(relativePath);
    }

    const usesPreVerificationPolicy = source.includes('getUserWithPolicy("required_unverified_ok"') ||
      source.includes("getUserWithPolicy('required_unverified_ok'");

    if (PRE_VERIFICATION_ALLOWLIST.has(relativePath)) {
      if (!usesPreVerificationPolicy) {
        missingPreVerificationPolicy.push(relativePath);
      }
      continue;
    }

    if (usesPreVerificationPolicy) {
      misplacedPreVerificationPolicy.push(relativePath);
    }
  }

  const hasViolations =
    rawGetUserViolations.length > 0 ||
    missingPreVerificationPolicy.length > 0 ||
    misplacedPreVerificationPolicy.length > 0;

  if (hasViolations) {
    console.error("\n[gate:auth-verified] violações detetadas:");

    if (rawGetUserViolations.length > 0) {
      console.error("\n- Uso direto de supabase.auth.getUser() (proibido):");
      for (const file of rawGetUserViolations) {
        console.error(`  • ${file}`);
      }
    }

    if (missingPreVerificationPolicy.length > 0) {
      console.error("\n- Rotas de pre-verificação sem policy required_unverified_ok:");
      for (const file of missingPreVerificationPolicy) {
        console.error(`  • ${file}`);
      }
    }

    if (misplacedPreVerificationPolicy.length > 0) {
      console.error("\n- Uso indevido de required_unverified_ok fora da allowlist:");
      for (const file of misplacedPreVerificationPolicy) {
        console.error(`  • ${file}`);
      }
    }

    process.exit(1);
  }

  console.log(
    `[gate:auth-verified] OK (${apiFiles.length} ficheiros API verificados, ` +
      `${PRE_VERIFICATION_ALLOWLIST.size} rotas de pre-verificação).`,
  );
}

main();
