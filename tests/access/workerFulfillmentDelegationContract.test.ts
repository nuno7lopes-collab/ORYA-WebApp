import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workerRoutePath = resolve(
  process.cwd(),
  "app/api/internal/worker/operations/route.ts",
);

describe("worker fulfillment delegation contract", () => {
  it("usa helper único de fulfillment para evitar lógica duplicada", () => {
    const file = readFileSync(workerRoutePath, "utf8");
    expect(file).toContain(
      'import { performPaymentFulfillment } from "@/lib/operations/performPaymentFulfillment"',
    );
    expect(file).not.toContain("async function performPaymentFulfillment(");
  });
});
