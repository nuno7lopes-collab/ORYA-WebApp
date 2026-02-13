import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DISALLOWED_ROUTE_FILES = [
  "app/org/[orgId]/checkin/page.tsx",
  "app/org/[orgId]/financas/page.tsx",
  "app/org/[orgId]/loja/page.tsx",
  "app/org/[orgId]/manage/page.tsx",
  "app/org/[orgId]/promote/page.tsx",
  "app/org/[orgId]/servicos/page.tsx",
  "app/org/[orgId]/trainers/page.tsx",
  "app/org/[orgId]/tournaments/page.tsx",
  "app/org/[orgId]/tournaments/new/page.tsx",
  "app/org/[orgId]/padel/page.tsx",
  "app/org/[orgId]/padel/tournaments/new/page.tsx",
  "app/org/[orgId]/perfil/seguidores/page.tsx",
  "app/org/[orgId]/crm/campanhas/page.tsx",
  "app/org/[orgId]/crm/clientes/page.tsx",
  "app/org/[orgId]/crm/clientes/[customerId]/page.tsx",
  "app/org/[orgId]/crm/relatorios/page.tsx",
  "app/org/[orgId]/crm/segmentos/page.tsx",
  "app/org/[orgId]/crm/segmentos/[segmentId]/page.tsx",
] as const;

describe("canonical org web route files", () => {
  it("has no PT/legacy entrypoints under app/org/[orgId]", () => {
    const present = DISALLOWED_ROUTE_FILES.filter((path) => existsSync(path));
    expect(present).toEqual([]);
  });
});
