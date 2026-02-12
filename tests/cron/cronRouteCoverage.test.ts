import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CRON_JOBS } from "@/lib/cron/jobs";

function listRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\/route\.(ts|tsx|js|jsx)$/.test(fullPath.replaceAll("\\", "/"))) {
      files.push(fullPath);
    }
  }
  return files;
}

function toEndpoint(filePath: string): string {
  const relToApi = path.relative(path.join(process.cwd(), "app", "api"), filePath).replaceAll("\\", "/");
  const routePath = relToApi.replace(/\/route\.(ts|tsx|js|jsx)$/, "");
  return `/api/${routePath}`;
}

describe("cron route coverage", () => {
  it("keeps app/api/cron routes and CRON_JOBS in sync", () => {
    const routeFiles = listRouteFiles(path.join(process.cwd(), "app", "api", "cron"));
    const routeEndpoints = new Set(routeFiles.map(toEndpoint));
    const jobEndpoints = new Set(CRON_JOBS.map((job) => job.endpoint));

    expect(routeEndpoints.size).toBeGreaterThan(0);
    expect(Array.from(routeEndpoints).sort()).toEqual(Array.from(jobEndpoints).sort());
  });
});
