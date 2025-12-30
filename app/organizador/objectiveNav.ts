export type ObjectiveTab = "manage" | "promote" | "analyze" | "profile";
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

export function normalizeOrgCategory(value?: string | null): OrgCategory {
  const normalized = value?.toUpperCase() ?? "";
  if (normalized === "PADEL") return "PADEL";
  if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
  return "EVENTOS";
}

export function getObjectiveSections(
  objective: ObjectiveTab,
  context: ObjectiveNavContext,
  _options?: { mode?: "dashboard" | "page" },
): ObjectiveNavSection[] {
  const sections: ObjectiveNavSection[] = [];

  if (objective === "manage") {
    sections.push({
      id: "eventos",
      label: "Eventos",
      href: "/organizador?tab=manage&section=eventos",
    });
    if (context.category === "PADEL") {
      sections.push({
        id: "padel-hub",
        label: "Hub Padel",
        href: "/organizador?tab=manage&section=padel-hub",
      });
      return sections;
    }
    sections.push({
      id: "inscricoes",
      label: "Inscrições",
      href: "/organizador?tab=manage&section=inscricoes",
    });
    return sections;
  }

  if (objective === "promote") {
    const baseHref = "/organizador?tab=promote&section=marketing&marketing=";
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

  if (objective === "profile") {
    return [
      {
        id: "perfil",
        label: "Perfil público",
        href: "/organizador?tab=profile",
      },
    ];
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
