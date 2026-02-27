import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public eventos list fallback statuses", () => {
  it("não inclui FINISHED no fallback de descoberta pública", () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/api/eventos/list/route.ts"),
      "utf8",
    );

    expect(file).toContain('import { EVENT_OPERATIONAL_STATUSES } from "@/domain/events/lifecycle"');
    expect(file).toContain("const fallbackStatuses = EVENT_OPERATIONAL_STATUSES");
    expect(file).not.toContain("EventStatus.FINISHED");
  });
});
