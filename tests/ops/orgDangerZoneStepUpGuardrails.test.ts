import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("organization danger-zone step-up guardrails", () => {
  it("keeps owner-only + step-up enforcement on suspend/reactivate/delete routes", () => {
    const suspendRoute = readLocal("app/api/org-hub/organizations/[id]/suspend/route.ts");
    const deleteRoute = readLocal("app/api/org-hub/organizations/[id]/route.ts");

    expect(suspendRoute).toContain("ONLY_OWNER_CAN_SUSPEND");
    expect(suspendRoute).toContain("ONLY_OWNER_CAN_REACTIVATE");
    expect(suspendRoute).toContain("requireOrganizationStepUp");
    expect(suspendRoute).toContain('action: "ORG_SUSPEND"');
    expect(suspendRoute).toContain('action: "ORG_REACTIVATE"');

    expect(deleteRoute).toContain("ONLY_OWNER_CAN_DELETE");
    expect(deleteRoute).toContain("requireOrganizationStepUp");
    expect(deleteRoute).toContain('action: "ORG_DELETE"');
  });

  it("keeps canonical email+code step-up security defaults", () => {
    const stepUp = readLocal("lib/organizationStepUp.ts");

    expect(stepUp).toContain("ORG_STEP_UP_CODE_TTL_MS = 10 * 60 * 1000");
    expect(stepUp).toContain("ORG_STEP_UP_MAX_ATTEMPTS = 5");
    expect(stepUp).toContain("ORG_STEP_UP_LOCKOUT_MS = 15 * 60 * 1000");
    expect(stepUp).toContain("/^\\d{6}$/");
    expect(stepUp).toContain("channel: \"email_code\"");
  });
});
