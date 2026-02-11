import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function listRoutes(prefix: string) {
  let output = "";
  try {
    output = execSync(`rg --files ${prefix} -g "route.ts"`, { stdio: "pipe", shell: "/bin/zsh" })
      .toString()
      .trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status === 1) {
      return [] as string[];
    }
    throw error;
  }
  if (!output) return [] as string[];
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

describe("store legacy tombstones", () => {
  it("keeps /api/me/store/** in 410 GONE", () => {
    const files = listRoutes("app/api/me/store");
    const offenders = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      return !(content.includes("status: 410") && content.includes("GONE"));
    });
    if (offenders.length > 0) {
      throw new Error(`Non-tombstone me/store routes:\n${offenders.join("\n")}`);
    }
  });

  it("keeps /api/organizacao/loja/** in 410 GONE", () => {
    const files = listRoutes("app/api/organizacao/loja");
    const offenders = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      return !(content.includes("status: 410") && content.includes("GONE"));
    });
    if (offenders.length > 0) {
      throw new Error(`Non-tombstone organizacao/loja routes:\n${offenders.join("\n")}`);
    }
  });

  it("removes /api/store/** legacy namespace", () => {
    const files = listRoutes("app/api/store");
    expect(files).toEqual([]);
  });
});
