import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel partnership contract guardrails (N3)", () => {
  it("fecha modelos e enums canónicos de parceria no schema", () => {
    const schema = readLocal("prisma/schema.prisma");
    expect(schema).toContain("model PadelPartnershipAgreement {");
    expect(schema).toContain("model PadelPartnershipWindow {");
    expect(schema).toContain("model PadelPartnershipBookingPolicy {");
    expect(schema).toContain("model PadelPartnerRoleGrant {");
    expect(schema).toContain("model PadelPartnerCourtSnapshot {");
    expect(schema).toContain("model PadelPartnershipCompensationCase {");
    expect(schema).toContain("reasonCode            String    @default(\"UNSPECIFIED\") @map(\"reason_code\")");
    expect(schema).toContain("executedByUserId      String?   @map(\"executed_by_user_id\") @db.Uuid");
    expect(schema).toContain("executionStatus       String?   @map(\"execution_status\")");
    expect(schema).toContain("model AgendaResourceClaim {");
    expect(schema).toContain("bundleId     String?                 @map(\"bundle_id\") @db.Uuid");
    expect(schema).toContain("enum PadelPartnershipStatus {");
    expect(schema).toContain("enum PadelPartnershipPriorityMode {");
    expect(schema).toContain("enum PadelPartnershipCompensationStatus {");
    expect(schema).toContain("enum AgendaResourceClaimType {");
    expect(schema).toContain("enum AgendaResourceClaimStatus {");
  });

  it("exige rotas canónicas de parcerias", () => {
    const agreements = readLocal("app/api/padel/partnerships/agreements/route.ts");
    const windows = readLocal("app/api/padel/partnerships/agreements/[id]/windows/route.ts");
    const grants = readLocal("app/api/padel/partnerships/agreements/[id]/grants/route.ts");
    const approve = readLocal("app/api/padel/partnerships/agreements/[id]/approve/route.ts");
    const pause = readLocal("app/api/padel/partnerships/agreements/[id]/pause/route.ts");
    const revoke = readLocal("app/api/padel/partnerships/agreements/[id]/revoke/route.ts");
    const overrides = readLocal("app/api/padel/partnerships/overrides/route.ts");
    const execute = readLocal("app/api/padel/partnerships/overrides/[id]/execute/route.ts");
    expect(agreements).toContain("export const POST = withApiEnvelope(_POST);");
    expect(windows).toContain("export const POST = withApiEnvelope(_POST);");
    expect(grants).toContain("export const POST = withApiEnvelope(_POST);");
    expect(approve).toContain("export const POST = withApiEnvelope(_POST);");
    expect(pause).toContain("export const POST = withApiEnvelope(_POST);");
    expect(revoke).toContain("export const POST = withApiEnvelope(_POST);");
    expect(overrides).toContain("export const POST = withApiEnvelope(_POST);");
    expect(execute).toContain("export const POST = withApiEnvelope(_POST);");
  });

  it("mantém write-path read-only para courts de clube parceiro", () => {
    const route = readLocal("app/api/padel/clubs/[id]/courts/route.ts");
    expect(route).toContain("if (club.kind === \"PARTNER\")");
    expect(route).toContain("return jsonWrap({ ok: false, error: \"CLUB_READ_ONLY\" }, { status: 403 });");
  });

  it("exige suporte de resource_claim no calendário canónico", () => {
    const route = readLocal("app/api/padel/calendar/route.ts");
    const commitRoute = readLocal("app/api/padel/calendar/claims/commit/route.ts");
    expect(route).toContain("type !== \"resource_claim\"");
    expect(route).toContain("RESOURCE_CLAIM_CONFLICT");
    expect(route).toContain("resourceClaims");
    expect(commitRoute).toContain("pg_advisory_xact_lock");
    expect(commitRoute).toContain("bundleId");
    expect(commitRoute).toContain("RESOURCE_CLAIM_CONFLICT");
    expect(commitRoute).toContain("PADEL_CALENDAR_CLAIMS_COMMIT");
  });

  it("fecha constraints de parceria no auto-schedule (fail-closed)", () => {
    const route = readLocal("app/api/padel/calendar/auto-schedule/route.ts");
    expect(route).toContain("resolvePartnershipScheduleConstraints");
    expect(route).toContain("PARTNERSHIP_CONSTRAINTS_BLOCKED");
    expect(route).toContain("effectiveCourtBlocks");
  });

  it("executa override com compensação determinística e fallback pendente", () => {
    const execute = readLocal("app/api/padel/partnerships/overrides/[id]/execute/route.ts");
    expect(execute).toContain("PENDING_COMPENSATION");
    expect(execute).toContain("AUTO_RESOLVED");
    expect(execute).toContain("COMPENSATION_WINDOW_HOURS = 48");
    expect(execute).toContain("reasonCode");
    expect(execute).toContain("padelPartnershipCompensationCase.create");
  });

  it("revoga grants expirados automaticamente no cron", () => {
    const cron = readLocal("app/api/cron/padel/partnership-grants/revoke/route.ts");
    expect(cron).toContain("autoRevoke: true");
    expect(cron).toContain("expiresAt: { lt: now }");
    expect(cron).toContain("revokedAt: now");
  });
});
