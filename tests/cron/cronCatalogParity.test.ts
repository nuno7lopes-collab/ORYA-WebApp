import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRON_JOBS } from "@/lib/cron/jobs";

type LoopJob = {
  key: string;
  method: "GET" | "POST";
  endpoint: string;
  envIntervalMs: string;
  defaultIntervalMs: number;
};

function parseCronLoopJobs(fileContent: string): LoopJob[] {
  const regex =
    /\{\s*name:\s*"([^"]+)"[\s\S]*?method:\s*"(GET|POST)"[\s\S]*?path:\s*"([^"]+)"[\s\S]*?intervalMs:\s*getInterval\("([^"]+)",\s*([0-9_]+)\)/g;

  const jobs: LoopJob[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(fileContent)) !== null) {
    jobs.push({
      key: match[1],
      method: match[2] as "GET" | "POST",
      endpoint: match[3],
      envIntervalMs: match[4],
      defaultIntervalMs: Number(match[5].replaceAll("_", "")),
    });
  }
  return jobs;
}

describe("cron catalog parity", () => {
  it("keeps scripts/cron-loop.js aligned with lib/cron/jobs.ts", () => {
    const file = readFileSync(resolve(process.cwd(), "scripts/cron-loop.js"), "utf8");
    const loopJobs = parseCronLoopJobs(file);
    const canonicalJobs = CRON_JOBS.map((job) => ({
      key: job.key,
      method: job.method,
      endpoint: job.endpoint,
      envIntervalMs: job.envIntervalMs,
      defaultIntervalMs: job.defaultIntervalMs,
    }));

    expect(loopJobs.length).toBeGreaterThan(0);
    expect(loopJobs).toEqual(canonicalJobs);
  });
});
