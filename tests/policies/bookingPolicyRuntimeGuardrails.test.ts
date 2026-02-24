import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

describe("booking policy runtime guardrails", () => {
  it("mantem validação e erro explicativo no PATCH da policy individual", () => {
    const file = read("app/api/org/[orgId]/policies/[id]/route.ts");
    expect(file).toContain("validateBookingPolicyWindowMinutes");
    expect(file).toContain("BOOKING_POLICY_WINDOW_OUT_OF_RANGE");
    expect(file).toContain("cancellationValidation.details");
    expect(file).toContain("rescheduleValidation.details");
  });

  it("mantem validação e erro explicativo no PATCH de política global", () => {
    const file = read("app/api/org/[orgId]/policies/route.ts");
    expect(file).toContain("validateOrgRescheduleWindowMinutes");
    expect(file).toContain("ORG_RESCHEDULE_WINDOW_OUT_OF_RANGE");
    expect(file).toContain("orgRescheduleWindowValidation.details");
  });

  it("mantem guardrails em tempo real no cliente de políticas", () => {
    const file = read("app/org/[orgId]/policies/PoliciesToolClient.tsx");
    expect(file).toContain("validateBookingPolicyWindowMinutes");
    expect(file).toContain("Guardrails ativos:");
    expect(file).toContain("valor personalizado inválido");
    expect(file).toContain("aria-invalid");
    expect(file).toContain("disabled={bookingSaving || Boolean(bookingDraftValidation && !bookingDraftValidation.ok)}");
  });
});
