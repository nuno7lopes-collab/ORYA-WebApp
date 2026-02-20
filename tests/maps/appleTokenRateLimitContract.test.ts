import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/maps/apple-token/route.ts");

describe("apple token rate-limit contract", () => {
  it("protege endpoint com rate limit", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("maps:apple-token");
    expect(file).toContain("APPLE_TOKEN_RATE_MAX");
    expect(file).toContain("APPLE_TOKEN_RATE_WINDOW_MS");
  });

  it("devolve THROTTLED (429) com Retry-After", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain('errorCode: "THROTTLED"');
    expect(file).toContain("status: 429");
    expect(file).toContain('"Retry-After": String(');
  });
});
