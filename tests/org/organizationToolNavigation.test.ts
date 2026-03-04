import { describe, expect, it } from "vitest";
import {
  buildOrganizationToolNavigation,
  resolveOrganizationSidebarState,
  type OrganizationSidebarAccess,
} from "@/app/org/_internal/core/organizationToolNavigation";

const ALL_ACCESS: OrganizationSidebarAccess = {
  canAccessReservas: true,
  canAccessTorneios: true,
  canAccessEventos: true,
  canAccessInscricoes: true,
  canAccessMensagens: true,
  canAccessCrm: true,
  canAccessAnalytics: true,
  canViewFinance: true,
  canPromote: true,
  canAccessLoja: true,
  canManageMembers: true,
  canEditOrgSettings: true,
};

describe("organizationToolNavigation", () => {
  it("mantem ordem canónica das 17 ferramentas", () => {
    const tools = buildOrganizationToolNavigation({ orgId: 42, access: ALL_ACCESS });
    expect(tools.map((tool) => tool.id)).toEqual([
      "dashboard",
      "calendar",
      "academy",
      "check-in",
      "padel-tournaments",
      "events",
      "padel-club",
      "forms",
      "chat",
      "crm",
      "analytics",
      "finance",
      "marketing",
      "store",
      "team",
      "policies",
      "settings",
    ]);
  });

  it("usa subnav canónica da Academia", () => {
    const tools = buildOrganizationToolNavigation({ orgId: 42, access: ALL_ACCESS });
    const academy = tools.find((tool) => tool.id === "academy");
    expect(academy?.items.map((item) => item.label)).toEqual([
      "Aulas",
      "Treinadores",
      "Alunos",
    ]);
    expect(academy?.items.map((item) => item.href)).toEqual([
      "/org/42/academy/classes",
      "/org/42/academy/trainers",
      "/org/42/academy/students",
    ]);
  });

  it("resolve subitem ativo por query para ferramentas baseadas em view/section", () => {
    const tools = buildOrganizationToolNavigation({ orgId: 42, access: ALL_ACCESS });
    const cases: Array<{ pathname: string; query: string; toolId: string; subId: string }> = [
      { pathname: "/org/42/forms", query: "section=responses", toolId: "forms", subId: "responses" },
      { pathname: "/org/42/analytics", query: "view=dimensions", toolId: "analytics", subId: "dimensions" },
      { pathname: "/org/42/finance", query: "view=exports", toolId: "finance", subId: "exports" },
      { pathname: "/org/42/marketing", query: "marketing=content", toolId: "marketing", subId: "content" },
      { pathname: "/org/42/store", query: "view=orders", toolId: "store", subId: "orders" },
      { pathname: "/org/42/team", query: "staff=auditoria", toolId: "team", subId: "audit" },
      { pathname: "/org/42/policies", query: "view=padel", toolId: "policies", subId: "padel" },
    ];

    for (const testCase of cases) {
      const state = resolveOrganizationSidebarState({
        tools,
        pathname: testCase.pathname,
        searchParams: new URLSearchParams(testCase.query),
      });
      expect(tools[state.activeToolIndex]?.id).toBe(testCase.toolId);
      const activeTool = tools.find((tool) => tool.id === testCase.toolId);
      const expectedSubIndex = activeTool?.items.findIndex((item) => item.id === testCase.subId) ?? -1;
      expect(state.activeSubIndexByToolId[testCase.toolId]).toBe(expectedSubIndex);
    }
  });

  it("mantem um unico subitem ativo e não vaza ativo para outras ferramentas", () => {
    const tools = buildOrganizationToolNavigation({ orgId: 42, access: ALL_ACCESS });
    const state = resolveOrganizationSidebarState({
      tools,
      pathname: "/org/42/calendar/day",
      searchParams: new URLSearchParams("view=categories&padel=teams&section=responses"),
    });

    expect(tools[state.activeToolIndex]?.id).toBe("calendar");
    const calendar = tools.find((tool) => tool.id === "calendar");
    const expectedAgendaIndex = calendar?.items.findIndex((item) => item.id === "agenda") ?? -1;
    expect(state.activeSubIndexByToolId.calendar).toBe(expectedAgendaIndex);

    const activeCount = Object.values(state.activeSubIndexByToolId).filter((index) => index >= 0).length;
    expect(activeCount).toBe(1);
    expect(state.activeSubIndexByToolId["padel-tournaments"]).toBe(-1);
    expect(state.activeSubIndexByToolId.analytics).toBe(-1);
    expect(state.activeSubIndexByToolId.forms).toBe(-1);
  });

  it("aplica visibilidade por permissões sem quebrar ordem relativa", () => {
    const tools = buildOrganizationToolNavigation({
      orgId: 42,
      access: {
        canAccessReservas: true,
        canAccessTorneios: false,
        canAccessEventos: false,
        canAccessInscricoes: false,
        canAccessMensagens: false,
        canAccessCrm: false,
        canAccessAnalytics: false,
        canViewFinance: false,
        canPromote: false,
        canAccessLoja: false,
        canManageMembers: false,
        canEditOrgSettings: false,
      },
    });
    expect(tools.map((tool) => tool.id)).toEqual(["dashboard", "calendar", "academy"]);
  });
});
