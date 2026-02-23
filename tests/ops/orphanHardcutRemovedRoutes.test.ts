import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const HARD_REMOVED_ROUTE_FILES = [
  "app/api/me/creditos/route.ts",
  "app/api/me/inscricoes/route.ts",
  "app/api/me/notifications/[id]/read/route.ts",
  "app/api/me/reservas/[id]/calendar.ics/route.ts",
  "app/api/org-hub/become/route.ts",
  "app/api/org-hub/organizations/owner/confirm/route.ts",
  "app/api/org-hub/organizations/owner/transfer/route.ts",
  "app/api/org/[orgId]/payouts/connect/route.ts",
  "app/api/org/[orgId]/payouts/list/route.ts",
  "app/api/org/[orgId]/payouts/settings/route.ts",
  "app/api/org/[orgId]/payouts/status/route.ts",
  "app/api/org/[orgId]/payouts/summary/route.ts",
  "app/api/org/[orgId]/servicos/[id]/duration-prices/route.ts",
  "app/api/org/[orgId]/trainers/route.ts",
  "app/api/org/[orgId]/padel/broadcast/route.ts",
  "app/api/org/[orgId]/padel/courts/route.ts",
  "app/api/padel/live/route.ts",
  "app/api/padel/live/raw/route.ts",
  "app/api/padel/matches/[id]/delay/route.ts",
  "app/api/padel/pairings/[id]/cancel/route.ts",
  "app/api/padel/pairings/[id]/reopen/route.ts",
  "app/api/padel/public/calendar/route.ts",
  "app/api/padel/rankings/rebuild/route.ts",
  "app/api/padel/tournaments/tier-approvals/request/route.ts",
  "app/api/padel/tournaments/tier-approvals/[id]/approve/route.ts",
  "app/api/padel/tournaments/tier-approvals/[id]/reject/route.ts",
  "app/api/servicos/[id]/booking-status/route.ts",
  "app/api/servicos/[id]/creditos/route.ts",
  "app/api/servicos/[id]/creditos/checkout/route.ts",
  "app/api/servicos/[id]/slots/route.ts",
  "app/api/servicos/[id]/disponibilidade/route.ts",
  "app/org/[orgId]/bookings/services/route.ts",
];

describe("legacy/orphan hard-cut removed routes", () => {
  it("não mantém ficheiros de rota legacy/orphan no runtime", () => {
    for (const relPath of HARD_REMOVED_ROUTE_FILES) {
      const absPath = resolve(process.cwd(), relPath);
      expect(existsSync(absPath), relPath).toBe(false);
    }
  });
});
