import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

function listRoutes(prefix: string) {
  let output = "";
  try {
    output = execSync(`rg --files ${prefix} -g "route.ts"`, { stdio: "pipe", shell: "/bin/zsh" })
      .toString()
      .trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && (error.status === 1 || error.status === 2)) {
      return [] as string[];
    }
    throw error;
  }
  if (!output) return [] as string[];
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

describe("store legacy hard-cut", () => {
  it("removes /api/me/store/** namespace", () => {
    const files = listRoutes("app/api/me/store");
    expect(files).toEqual([]);
  });

  it("removes /api/org/1/loja/** namespace", () => {
    const files = listRoutes("app/api/org/[orgId]/loja");
    expect(files).toEqual([]);
  });

  it("removes /api/store/** legacy namespace", () => {
    const files = listRoutes("app/api/store");
    expect(files).toEqual([]);
  });
});
