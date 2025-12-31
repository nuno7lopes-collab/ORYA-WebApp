import { normalizeOrganizationCategory, type OrganizationCategory } from "@/lib/organizationCategories";

export type ObjectiveTab = "create" | "manage" | "promote" | "analyze";
export type OrgCategory = OrganizationCategory;

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
    createHref: string;
  }
> = {
  EVENTOS: {
    createLabel: "Criar evento",
    createHref: "/organizador/eventos/novo",
  },
  PADEL: {
    createLabel: "Criar evento",
    createHref: "/organizador/eventos/novo?preset=padel",
  },
  RESERVAS: {
    createLabel: "Criar serviço",
    createHref: "/organizador/reservas/novo",
  },
  CLUBS: {
    createLabel: "Criar clube",
    createHref: "/em-breve",
  },
};

export function normalizeOrgCategory(value?: string | null): OrgCategory {
  return normalizeOrganizationCategory(value);
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
          label: "Inscrições",
          href: "/organizador/inscricoes",
        });
      }
    }
    return sections;
  }

  if (objective === "manage") {
    if (context.category === "RESERVAS") {
      sections.push({
        id: "reservas",
        label: "Reservas",
        href: "/organizador/reservas",
      });
      return sections;
    }
    sections.push({
      id: "eventos",
      label: "Eventos",
      href: "/organizador?tab=manage&section=eventos",
    });
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
