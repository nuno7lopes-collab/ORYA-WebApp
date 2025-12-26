export type ObjectiveTab = "create" | "manage" | "promote" | "analyze";
export type OrgCategory = "EVENTOS" | "PADEL" | "VOLUNTARIADO";

export type ObjectiveNavContext = {
  category: OrgCategory;
  modules: string[];
  username?: string | null;
};

export type ObjectiveNavSection = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

const CATEGORY_META: Record<
  OrgCategory,
  {
    createLabel: string;
    manageLabel: string;
    createHref: string;
    manageSection: string;
  }
> = {
  EVENTOS: {
    createLabel: "Criar evento",
    manageLabel: "Eventos",
    createHref: "/organizador/eventos/novo",
    manageSection: "eventos",
  },
  PADEL: {
    createLabel: "Criar evento",
    manageLabel: "Eventos",
    createHref: "/organizador/eventos/novo?preset=padel",
    manageSection: "eventos",
  },
  VOLUNTARIADO: {
    createLabel: "Criar evento",
    manageLabel: "Eventos",
    createHref: "/organizador/eventos/novo?preset=voluntariado",
    manageSection: "acoes",
  },
};

export function normalizeOrgCategory(value?: string | null): OrgCategory {
  const normalized = value?.toUpperCase() ?? "";
  if (normalized === "PADEL") return "PADEL";
  if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
  return "EVENTOS";
}

function hasModule(modules: string[], key: string) {
  return Array.isArray(modules) && modules.includes(key);
}

export function getObjectiveSections(
  objective: ObjectiveTab,
  context: ObjectiveNavContext,
  options?: { mode?: "dashboard" | "page" },
): ObjectiveNavSection[] {
  const categoryMeta = CATEGORY_META[context.category];
  const sections: ObjectiveNavSection[] = [];
  const isDashboard = options?.mode === "dashboard";

  if (objective === "create") {
    sections.push({
      id: "overview",
      label: "Resumo",
      href: "/organizador?tab=overview",
    });
    if (!isDashboard) {
      sections.push({
        id: "primary",
        label: categoryMeta.createLabel,
        href: categoryMeta.createHref,
      });
      if (hasModule(context.modules, "INSCRICOES")) {
        sections.push({
          id: "inscricoes",
          label: "Formulários",
          href: "/organizador/inscricoes",
        });
      }
    }
    return sections;
  }

  if (objective === "manage") {
    sections.push({
      id: "eventos",
      label: "Eventos",
      href: "/organizador?tab=manage&section=eventos",
    });
    sections.push({
      id: "livehub",
      label: "LiveHub",
      href: "/organizador?tab=manage&section=livehub",
    });
    sections.push({
      id: "checkin",
      label: "Check-in",
      href: "/organizador?tab=manage&section=checkin",
    });
    if (context.category === "PADEL") {
      sections.push({
        id: "padel-hub",
        label: "Hub Padel",
        href: "/organizador?tab=manage&section=padel-hub",
      });
    }
    return sections;
  }

  if (objective === "promote") {
    const baseHref = "/organizador?tab=promote&section=marketing&marketing=";
    sections.push({
      id: "perfil",
      label: "Perfil público",
      href: `${baseHref}perfil`,
    });
    sections.push({
      id: "overview",
      label: "Visão geral",
      href: `${baseHref}overview`,
    });
    sections.push({
      id: "promos",
      label: "Códigos promocionais",
      href: `${baseHref}promos`,
    });
    sections.push({
      id: "updates",
      label: "Canal oficial",
      href: `${baseHref}updates`,
    });
    sections.push({
      id: "promoters",
      label: "Promotores e parcerias",
      href: `${baseHref}promoters`,
    });
    sections.push({
      id: "content",
      label: "Conteúdos e kits",
      href: `${baseHref}content`,
    });
    return sections;
  }

  return [
    {
      id: "financas",
      label: "Finanças",
      href: "/organizador?tab=analyze&section=financas",
    },
    {
      id: "invoices",
      label: "Faturação",
      href: "/organizador?tab=analyze&section=invoices",
    },
  ];
}
