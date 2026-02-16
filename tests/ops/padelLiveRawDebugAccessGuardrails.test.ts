import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live raw debug access guardrails", () => {
  it("endpoint raw existe e é protegido por ambiente/permissão", () => {
    const route = readLocal("app/api/padel/live/raw/route.ts");

    expect(route).toContain("getAppEnv");
    expect(route).toContain("requireAdminUser");
    expect(route).toContain('RAW_LIVE_ADMIN_REQUIRED');
    expect(route).toContain("verifyMfaSession");
    expect(route).toContain('STEP_UP_REQUIRED');
  });

  it("regista auditoria em leitura raw", () => {
    const route = readLocal("app/api/padel/live/raw/route.ts");
    expect(route).toContain("auditAdminAction");
    expect(route).toContain("recordOrganizationAuditSafe");
    expect(route).toContain("PADEL_LIVE_RAW_READ");
  });
});
