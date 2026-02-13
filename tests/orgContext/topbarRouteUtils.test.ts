import { describe, expect, it } from "vitest";
import { normalizeOrganizationPathname } from "@/app/organizacao/topbarRouteUtils";

describe("normalizeOrganizationPathname", () => {
  it("normaliza /organizacao/overview para /organizacao", () => {
    expect(normalizeOrganizationPathname("/organizacao/overview")).toBe("/organizacao");
  });

  it("mantem rotas legadas que ja estao corretas", () => {
    expect(normalizeOrganizationPathname("/organizacao/manage")).toBe("/organizacao/manage");
    expect(normalizeOrganizationPathname("/organizacao/analyze")).toBe("/organizacao/analyze");
  });

  it("normaliza rotas canonicas /org/:id base e overview", () => {
    expect(normalizeOrganizationPathname("/org/50")).toBe("/organizacao");
    expect(normalizeOrganizationPathname("/org/50/")).toBe("/organizacao");
    expect(normalizeOrganizationPathname("/org/50/overview")).toBe("/organizacao");
  });

  it("normaliza rotas canonicas principais", () => {
    expect(normalizeOrganizationPathname("/org/50/operations")).toBe("/organizacao/manage");
    expect(normalizeOrganizationPathname("/org/50/manage")).toBe("/organizacao/manage");
    expect(normalizeOrganizationPathname("/org/50/marketing")).toBe("/organizacao/promote");
    expect(normalizeOrganizationPathname("/org/50/promote")).toBe("/organizacao/promote");
    expect(normalizeOrganizationPathname("/org/50/profile")).toBe("/organizacao/profile");
    expect(normalizeOrganizationPathname("/org/50/profile/followers")).toBe("/organizacao/profile/seguidores");
    expect(normalizeOrganizationPathname("/org/50/perfil/seguidores")).toBe("/organizacao/profile");
    expect(normalizeOrganizationPathname("/org/50/analytics")).toBe("/organizacao/analyze");
    expect(normalizeOrganizationPathname("/org/50/finance")).toBe("/organizacao/analyze");
    expect(normalizeOrganizationPathname("/org/50/financas")).toBe("/organizacao/analyze");
    expect(normalizeOrganizationPathname("/org/50/check-in")).toBe("/organizacao/scan");
    expect(normalizeOrganizationPathname("/org/50/checkin")).toBe("/organizacao/scan");
    expect(normalizeOrganizationPathname("/org/50/bookings")).toBe("/organizacao/reservas");
  });

  it("normaliza subrotas de settings e loja", () => {
    expect(normalizeOrganizationPathname("/org/50/settings")).toBe("/organizacao/settings");
    expect(normalizeOrganizationPathname("/org/50/settings/verify")).toBe("/organizacao/settings/verify");
    expect(normalizeOrganizationPathname("/org/50/store")).toBe("/organizacao/loja");
    expect(normalizeOrganizationPathname("/org/50/store/produtos")).toBe("/organizacao/loja/produtos");
  });

  it("nao altera rotas canonicas desconhecidas", () => {
    expect(normalizeOrganizationPathname("/org/50/qualquer-coisa")).toBe("/org/50/qualquer-coisa");
  });

  it("suporta pathname null", () => {
    expect(normalizeOrganizationPathname(null)).toBeNull();
  });
});
