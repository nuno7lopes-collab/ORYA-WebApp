import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live no-bypass guardrails", () => {
  it("força workflow canónico no write-path genérico de matches", () => {
    const matchesRoute = readLocal("app/api/padel/matches/route.ts");
    expect(matchesRoute).toContain("RESULT_WORKFLOW_REQUIRED");
    expect(matchesRoute).toContain("SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT");
  });

  it("mantém endpoints canónicos dedicados para workflow de resultado", () => {
    const submit = readLocal("app/api/padel/matches/[id]/result/submit/route.ts");
    const confirm = readLocal("app/api/padel/matches/[id]/result/confirm/route.ts");
    const reject = readLocal("app/api/padel/matches/[id]/result/reject/route.ts");
    const resetPending = readLocal("app/api/padel/matches/[id]/result/reset-pending/route.ts");
    const override = readLocal("app/api/padel/matches/[id]/result/override/route.ts");

    expect(submit).toContain('action: "submit_result"');
    expect(confirm).toContain('action: "confirm_result"');
    expect(reject).toContain('action: "reject_result"');
    expect(resetPending).toContain('action: "reset_pending_result"');
    expect(override).toContain('action: "override_result"');
  });
});

