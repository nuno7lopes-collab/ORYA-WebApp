import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/servicos/[id]/booking-status/route.ts");

describe("booking status security contract", () => {
  it("aplica rate limit por IP e por email", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("servicos:booking-status:ip");
    expect(file).toContain("servicos:booking-status:email");
    expect(file).toContain("BOOKING_STATUS_IP_MAX");
    expect(file).toContain("BOOKING_STATUS_EMAIL_MAX");
  });

  it("responde 429 com Retry-After quando throttled", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain('{ status: 429, headers: { "Retry-After": String(');
    expect(file).toContain('{ ok: false, error: "THROTTLED" }');
  });
});
