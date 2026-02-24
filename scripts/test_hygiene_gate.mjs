#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "reports", "tests_hygiene_gate_latest.json");

const SCAN_ROOTS = ["tests", "app", "lib", "domain", "components", "packages", "apps/mobile"];
const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "output",
  "test-results",
  "tmp",
]);

const UNIT_TEST_FILE_RE = /(?:^|\/).*?\.(?:test|spec)\.[mc]?[jt]sx?$/;
const PLAYWRIGHT_TEST_FILE_RE = /^tests\/ui\/web\/.*\.pw\.mjs$/;
const TEST_FILE_RE = /(?:^|\/)(__tests__\/.*|.*\.(?:test|spec)\.[mc]?[jt]sx?|tests\/ui\/web\/.*\.pw\.mjs)$/;

const TEST_CALL_RE = /\b(?:it|test)(?:\s*\.\s*each)?\s*\(/g;
const EXPECT_RE = /\bexpect\s*\(/g;
const MOCK_RE = /\b(?:vi|jest)\s*\.\s*(?:mock|fn|spyOn)\s*\(/g;
const SKIP_OR_TODO_RE = /\b(?:it|test|describe)\s*\.\s*skip\b|\b(?:it|test)\s*\.\s*todo\b/g;
const ONLY_RE = /\b(?:it|test|describe)\s*\.\s*only\b/g;
const TITLE_RE = /\b(?:it|test|describe)\s*\(\s*(['"`])(.+?)\1/g;
const ROUTE_IMPORT_RE = /["'`]@\/(app\/api\/[^"'`]+\/route(?:\.[mc]?[jt]sx?)?)["'`]/g;

const ROUTE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

const LEGACY_MARKERS = [
  "create_user.ts",
  "create_company.ts",
  "seed_rich_demo.ts",
  "seed_reservas_bootstrap.ts",
  "backfill_organization_modules_baseline.ts",
  "user:create",
  "company:create",
  "seed:rich-demo",
  "seed:reservas:bootstrap",
  "orgs:modules-backfill",
  "seed:local:rich-demo",
];

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function ensureReportsDir() {
  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function collectCandidateFiles() {
  const collected = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absRoot = path.join(ROOT, scanRoot);
    if (!fs.existsSync(absRoot)) continue;

    const stack = [absRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const absPath = path.join(current, entry.name);
        const relPath = path.relative(ROOT, absPath).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name)) {
            stack.push(absPath);
          }
          continue;
        }

        if (!TEST_FILE_RE.test(relPath)) continue;
        collected.push(relPath);
      }
    }
  }

  return uniqueSorted(collected);
}

function routeImportExists(routeImportPath) {
  const absFromImport = path.join(ROOT, routeImportPath);
  if (path.extname(routeImportPath)) {
    return fs.existsSync(absFromImport);
  }
  for (const extension of ROUTE_EXTENSIONS) {
    if (fs.existsSync(`${absFromImport}${extension}`)) {
      return true;
    }
  }
  return false;
}

function analyzeFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  const content = fs.readFileSync(absPath, "utf8");

  const tests = countMatches(content, TEST_CALL_RE);
  const expects = countMatches(content, EXPECT_RE);
  const mocks = countMatches(content, MOCK_RE);
  const hasSkipOrTodo = countMatches(content, SKIP_OR_TODO_RE) > 0;
  const hasOnly = countMatches(content, ONLY_RE) > 0;

  const titles = [];
  for (const match of content.matchAll(TITLE_RE)) {
    const title = String(match[2] ?? "").trim();
    if (!title) continue;
    titles.push(title);
  }

  const routeImports = [];
  for (const match of content.matchAll(ROUTE_IMPORT_RE)) {
    routeImports.push(String(match[1]));
  }
  const uniqueRouteImports = uniqueSorted(routeImports);
  const missingRouteImports = uniqueRouteImports.filter((routeImport) => !routeImportExists(routeImport));

  const legacyHits = LEGACY_MARKERS.filter((marker) => content.includes(marker));

  const isUnitTestFile = UNIT_TEST_FILE_RE.test(relPath);
  const hasZeroExpect = isUnitTestFile && tests > 0 && expects === 0;
  const highMockLowExpect = tests > 0 && mocks >= 6 && expects <= 2;

  return {
    file: relPath,
    tests,
    expects,
    mocks,
    hasSkipOrTodo,
    hasOnly,
    titles,
    routeImports: uniqueRouteImports,
    missingRouteImports,
    legacyHits,
    hasZeroExpect,
    highMockLowExpect,
    isPlaywrightTest: PLAYWRIGHT_TEST_FILE_RE.test(relPath),
  };
}

function main() {
  const files = collectCandidateFiles();
  if (files.length === 0) {
    console.error("Test hygiene gate falhou: nenhum ficheiro de teste encontrado.");
    process.exit(1);
  }

  const analyses = files.map(analyzeFile);

  const totals = analyses.reduce(
    (acc, item) => {
      acc.tests += item.tests;
      acc.expects += item.expects;
      acc.mocks += item.mocks;
      acc.routeImports += item.routeImports.length;
      return acc;
    },
    { files: analyses.length, tests: 0, expects: 0, mocks: 0, routeImports: 0 },
  );

  const zeroExpect = analyses.filter((item) => item.hasZeroExpect).map((item) => item.file);
  const highMockLowExpect = analyses
    .filter((item) => item.highMockLowExpect)
    .map((item) => ({ file: item.file, tests: item.tests, expects: item.expects, mocks: item.mocks }));
  const skipOrTodo = analyses.filter((item) => item.hasSkipOrTodo).map((item) => item.file);
  const onlyUsage = analyses.filter((item) => item.hasOnly).map((item) => item.file);

  const titleToFiles = new Map();
  for (const item of analyses) {
    for (const title of item.titles) {
      const filesForTitle = titleToFiles.get(title) ?? [];
      filesForTitle.push(item.file);
      titleToFiles.set(title, filesForTitle);
    }
  }
  const duplicateTitlesTop = Array.from(titleToFiles.entries())
    .map(([title, dupFiles]) => ({ title, files: uniqueSorted(dupFiles) }))
    .filter((entry) => entry.files.length > 1)
    .sort((a, b) => b.files.length - a.files.length || a.title.localeCompare(b.title))
    .slice(0, 20);

  const legacyReferences = analyses
    .filter((item) => item.legacyHits.length > 0)
    .map((item) => ({ file: item.file, hits: item.legacyHits }));

  const missingRouteImports = analyses.flatMap((item) =>
    item.missingRouteImports.map((routeImport) => ({ file: item.file, routeImport })),
  );

  const routeOverlapCounter = new Map();
  for (const item of analyses) {
    for (const routeImport of item.routeImports) {
      const testsForRoute = routeOverlapCounter.get(routeImport) ?? [];
      testsForRoute.push(item.file);
      routeOverlapCounter.set(routeImport, testsForRoute);
    }
  }
  const routeOverlaps = Array.from(routeOverlapCounter.entries())
    .map(([route, testFiles]) => {
      const uniqueTests = uniqueSorted(testFiles);
      return { route, tests: uniqueTests, count: uniqueTests.length };
    })
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    smells: {
      zeroExpect,
      highMockLowExpect,
      skipOrTodo,
      only: onlyUsage,
      legacyReferences,
      missingRouteImports,
      duplicateTitlesTop,
    },
    routeOverlaps,
  };

  ensureReportsDir();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const errors = [];
  if (onlyUsage.length > 0) {
    errors.push(`uso de .only em ${onlyUsage.length} ficheiro(s)`);
  }
  if (legacyReferences.length > 0) {
    errors.push(`referências legacy encontradas em ${legacyReferences.length} ficheiro(s)`);
  }
  if (missingRouteImports.length > 0) {
    errors.push(`imports de rotas inexistentes em ${missingRouteImports.length} ocorrência(s)`);
  }

  if (errors.length > 0) {
    console.error("Test hygiene gate falhou:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error(`Relatório: ${path.relative(ROOT, REPORT_PATH)}`);
    process.exit(1);
  }

  console.log(
    `Test hygiene gate: OK (files:${totals.files} tests:${totals.tests} expects:${totals.expects} mocks:${totals.mocks} routes:${totals.routeImports})`,
  );
  console.log(`Warnings: zeroExpect:${zeroExpect.length} highMockLowExpect:${highMockLowExpect.length} skipOrTodo:${skipOrTodo.length}`);
  console.log(`Info: routeOverlaps:${routeOverlaps.length}`);
  console.log(`Relatório: ${path.relative(ROOT, REPORT_PATH)}`);
}

main();
