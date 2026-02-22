import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GET /api/padel/calendar payload operacional", () => {
  it("expõe classSessions, bookings e occupancyItems sem quebrar contrato atual", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/calendar/route.ts"),
      "utf8",
    );

    expect(source).toContain("classSessions");
    expect(source).toContain("bookings:");
    expect(source).toContain("occupancyItems");
    expect(source).toContain("type: \"CLASS_SESSION\"");
    expect(source).toContain("type: \"BOOKING\"");
  });
});

