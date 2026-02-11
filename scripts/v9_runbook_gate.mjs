import { execSync } from "child_process";

const WATCH_DIRS = ["domain/outbox/", "app/api/internal/"];
const REQUIRED_DOCS = ["docs/ssot_registry.md", "docs/planning_registry.md"];

function runGit(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function hasRef(ref) {
  try {
    execSync(`git show-ref --verify --quiet ${ref}`);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef() {
  const envBase = process.env.GITHUB_BASE_REF || process.env.BASE_REF;
  if (envBase) {
    if (hasRef(`refs/remotes/origin/${envBase}`)) return `origin/${envBase}`;
    if (hasRef(`refs/heads/${envBase}`)) return envBase;
  }

  const candidates = [
    "origin/develop",
    "origin/developer",
    "origin/main",
    "develop",
    "developer",
    "main",
  ];

  for (const candidate of candidates) {
    const ref = candidate.startsWith("origin/")
      ? `refs/remotes/${candidate}`
      : `refs/heads/${candidate}`;
    if (hasRef(ref)) return candidate;
  }

  return null;
}

function listChangedFiles() {
  const baseRef = resolveBaseRef();
  const ranges = [];
  if (baseRef) {
    ranges.push(`${baseRef}...HEAD`);
  }
  ranges.push("HEAD~1");

  for (const range of ranges) {
    try {
      const output = runGit(`git diff --name-only ${range}`);
      if (output) {
        return output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/\\/g, "/"));
      }
    } catch {
      // try next range
    }
  }

  return [];
}

const changedFiles = listChangedFiles();
if (changedFiles.length === 0) {
  console.log("V9 runbook gate: OK (no diff)");
  process.exit(0);
}

const touchesWatched = changedFiles.some((file) =>
  WATCH_DIRS.some((dir) => file.startsWith(dir)),
);
const touchesRequiredDocs = changedFiles.some((file) =>
  REQUIRED_DOCS.includes(file),
);

if (touchesWatched && !touchesRequiredDocs) {
  console.error(
    "\n[DOC UPDATE REQUIRED] Changes detected in domain/outbox or app/api/internal without canonical doc updates.",
  );
  console.error(`- Update ${REQUIRED_DOCS.join(" or ")}`);
  console.error("\nChanged files:");
  changedFiles.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log("V9 runbook gate: OK");
