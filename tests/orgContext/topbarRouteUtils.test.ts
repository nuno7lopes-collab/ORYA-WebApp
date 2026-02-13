import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationPathname,
  resolveOrganizationTool,
} from "@/app/organizacao/topbarRouteUtils";

describe("normalizeOrganizationPathname", () => {
  it("normalizes canonical /org base routes", () => {
    expect(normalizeOrganizationPathname("/org/50")).toBe("/org/50/overview");
    expect(normalizeOrganizationPathname("/org/50/")).toBe("/org/50/overview");
    expect(normalizeOrganizationPathname("/org/50/overview")).toBe("/org/50/overview");
  });

  it("keeps legacy slugs under /org unchanged (hard-cut handled by proxy)", () => {
    expect(normalizeOrganizationPathname("/org/50/financas")).toBe("/org/50/financas");
    expect(normalizeOrganizationPathname("/org/50/faturacao")).toBe("/org/50/faturacao");
    expect(normalizeOrganizationPathname("/org/50/checkin")).toBe("/org/50/checkin");
    expect(normalizeOrganizationPathname("/org/50/loja")).toBe("/org/50/loja");
    expect(normalizeOrganizationPathname("/org/50/promote")).toBe("/org/50/promote");
    expect(normalizeOrganizationPathname("/org/50/crm/clientes")).toBe("/org/50/crm/clientes");
    expect(normalizeOrganizationPathname("/org/50/crm/segmentos/seg-1")).toBe("/org/50/crm/segmentos/seg-1");
    expect(normalizeOrganizationPathname("/org/50/crm/campanhas")).toBe("/org/50/crm/campanhas");
    expect(normalizeOrganizationPathname("/org/50/crm/relatorios")).toBe("/org/50/crm/relatorios");
    expect(normalizeOrganizationPathname("/org/50/padel/clube")).toBe("/org/50/padel/clube");
    expect(normalizeOrganizationPathname("/org/50/padel/torneios")).toBe("/org/50/padel/torneios");
    expect(normalizeOrganizationPathname("/org/50/padel/torneios/novo")).toBe("/org/50/padel/torneios/novo");
    expect(normalizeOrganizationPathname("/org/50/padel/tournaments/new")).toBe("/org/50/padel/tournaments/new");
    expect(normalizeOrganizationPathname("/org/50/trainers")).toBe("/org/50/trainers");
  });

  it("keeps non-org routes untouched", () => {
    expect(normalizeOrganizationPathname("/org-hub/organizations")).toBe("/org-hub/organizations");
    expect(normalizeOrganizationPathname("/api/org/50/me")).toBe("/api/org/50/me");
  });

  it("keeps /organizacao paths untouched for legacy handling", () => {
    expect(normalizeOrganizationPathname("/organizacao")).toBe("/organizacao");
    expect(normalizeOrganizationPathname("/organizacao/crm/clientes")).toBe("/organizacao/crm/clientes");
  });

  it("supports null", () => {
    expect(normalizeOrganizationPathname(null)).toBeNull();
  });
});

describe("resolveOrganizationTool", () => {
  it("resolves canonical tools", () => {
    expect(resolveOrganizationTool("/org/50/overview")).toBe("dashboard");
    expect(resolveOrganizationTool("/org/50/events")).toBe("events");
    expect(resolveOrganizationTool("/org/50/bookings")).toBe("bookings");
    expect(resolveOrganizationTool("/org/50/check-in/scanner")).toBe("check-in");
    expect(resolveOrganizationTool("/org/50/finance/ledger")).toBe("finance");
    expect(resolveOrganizationTool("/org/50/analytics/occupancy")).toBe("analytics");
    expect(resolveOrganizationTool("/org/50/crm/customers")).toBe("crm");
    expect(resolveOrganizationTool("/org/50/store")).toBe("store");
    expect(resolveOrganizationTool("/org/50/forms/responses")).toBe("forms");
    expect(resolveOrganizationTool("/org/50/chat/preview")).toBe("chat");
    expect(resolveOrganizationTool("/org/50/team/trainers")).toBe("team");
    expect(resolveOrganizationTool("/org/50/padel/clubs/players")).toBe("padel-club");
    expect(resolveOrganizationTool("/org/50/padel/tournaments/create")).toBe("padel-tournaments");
    expect(resolveOrganizationTool("/org/50/marketing/promos")).toBe("marketing");
    expect(resolveOrganizationTool("/org/50/profile/followers")).toBe("profile");
    expect(resolveOrganizationTool("/org/50/settings/verify")).toBe("settings");
  });

  it("falls back to dashboard for unknown canonical subpaths", () => {
    expect(resolveOrganizationTool("/org/50/unknown-route")).toBe("dashboard");
  });

  it("returns null outside /org/:orgId", () => {
    expect(resolveOrganizationTool("/org-hub/organizations")).toBeNull();
    expect(resolveOrganizationTool("/organizacao/manage")).toBeNull();
    expect(resolveOrganizationTool(null)).toBeNull();
  });
});
