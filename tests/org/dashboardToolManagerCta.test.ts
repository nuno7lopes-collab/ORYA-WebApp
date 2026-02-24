import { describe, expect, it } from "vitest";
import { CORE_ORGANIZATION_MODULES, ORGANIZATION_MODULES } from "@/lib/organizationCategories";
import {
  DASHBOARD_TOOL_ACTIVATION_CATALOG,
  canManageOrganizationTools,
  getAvailableDashboardToolActivationCards,
  shouldShowDashboardToolManagerCta,
} from "@/lib/organizationDashboardTools";

describe("dashboard tool manager", () => {
  it("lista ferramentas ativaveis que ainda nao estao ativas", () => {
    const cards = getAvailableDashboardToolActivationCards([
      "EVENTOS",
      "STAFF",
      "FINANCEIRO",
      "MARKETING",
      "CRM",
      "ANALYTICS",
      "DEFINICOES",
      "PERFIL_PUBLICO",
      "LOJA",
    ]);
    const toolKeys = cards.map((card) => card.moduleKey);
    expect(toolKeys).toEqual(["RESERVAS", "TORNEIOS", "INSCRICOES", "MENSAGENS"]);
  });

  it("mostra CTA quando dono/co-dono/admin tem ferramentas por ativar", () => {
    const visible = shouldShowDashboardToolManagerCta({
      canCustomizeTools: true,
      hasHiddenTools: false,
      canManageTools: true,
      hasAvailableToolCards: true,
    });
    expect(visible).toBe(true);
  });

  it("mantem CTA para dono/co-dono/admin mesmo sem ferramentas por ativar", () => {
    const visible = shouldShowDashboardToolManagerCta({
      canCustomizeTools: true,
      hasHiddenTools: false,
      canManageTools: true,
      hasAvailableToolCards: false,
    });
    expect(visible).toBe(true);
  });

  it("mantem CTA para quem pode gerir visibilidade quando existem ocultas", () => {
    const visible = shouldShowDashboardToolManagerCta({
      canCustomizeTools: true,
      hasHiddenTools: true,
      canManageTools: false,
      hasAvailableToolCards: false,
    });
    expect(visible).toBe(true);
  });

  it("esconde CTA quando nao ha permissao e nao existem ocultas", () => {
    const visible = shouldShowDashboardToolManagerCta({
      canCustomizeTools: false,
      hasHiddenTools: false,
      canManageTools: false,
      hasAvailableToolCards: true,
    });
    expect(visible).toBe(false);
  });

  it("normaliza role para permissao de gerir ferramentas", () => {
    expect(canManageOrganizationTools("OWNER")).toBe(true);
    expect(canManageOrganizationTools("co_owner")).toBe(true);
    expect(canManageOrganizationTools("admin")).toBe(true);
    expect(canManageOrganizationTools(null)).toBe(false);
  });

  it("catalogo de ativacao cobre todas as ferramentas nao-core", () => {
    const coreSet = new Set(CORE_ORGANIZATION_MODULES);
    const nonCoreModules = ORGANIZATION_MODULES.filter((moduleKey) => !coreSet.has(moduleKey)).sort();
    const catalogModules = Array.from(
      new Set(DASHBOARD_TOOL_ACTIVATION_CATALOG.map((card) => card.moduleKey)),
    ).sort();
    expect(catalogModules).toEqual(nonCoreModules);
  });
});
