import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ui surface inventory snapshot", () => {
  it("is synchronized with repository surfaces", () => {
    expect(() =>
      execFileSync("node", ["scripts/uiux_surface_inventory.mjs", "--check"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ).not.toThrow();
  });

  it("keeps minimum expected frontend surface breadth", () => {
    const snapshotPath = resolve(process.cwd(), "tests/ui/surface-inventory/surface-inventory.snapshot.json");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      counts: {
        webTotal: number;
        mobileTotal: number;
        org: number;
        admin: number;
        user: number;
        public: number;
      };
    };

    expect(snapshot.counts.webTotal).toBeGreaterThanOrEqual(220);
    expect(snapshot.counts.mobileTotal).toBeGreaterThanOrEqual(40);
    expect(snapshot.counts.org).toBeGreaterThanOrEqual(70);
    expect(snapshot.counts.admin).toBeGreaterThanOrEqual(15);
    expect(snapshot.counts.user).toBeGreaterThanOrEqual(10);
    expect(snapshot.counts.public).toBeGreaterThanOrEqual(40);
  });
});
