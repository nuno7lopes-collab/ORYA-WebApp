import { resolvePrimaryModule, type OperationModule } from "@/lib/organizationCategories";

export type ObjectiveTab = "create" | "manage" | "promote" | "analyze" | "profile";

export type ObjectiveNavContext = {
  primaryModule?: string | null;
  modules: string[];
  username?: string | null;
};

export type ObjectiveNavSection = {
  id: string;
  label: string;
  href: string;
  description?: string;
  items?: ObjectiveNavSection[];
  badge?: string;
  disabled?: boolean;
};

const PRIMARY_META: Record<
  OperationModule,
  {
    createLabel: string;
    createHref: string;
  }
> = {
  EVENTOS: {
    createLabel: "Criar evento",
    createHref: "/org/eventos/novo",
  },
  TORNEIOS: {
    createLabel: "Criar torneio",
    createHref: "/org/padel/torneios/novo",
  },
  RESERVAS: {
    createLabel: "Criar serviço",
    createHref: "/org/reservas?create=service",
  },
};
const PADEL_CLUB_SECTION = "padel-club";
const PADEL_TOURNAMENTS_SECTION = "padel-tournaments";

function hasModule(modules: string[], key: string) {
  return Array.isArray(modules) && modules.includes(key);
}

function resolvePrimaryOperation(primaryModule: string | null | undefined, modules: string[]): OperationModule {
  return resolvePrimaryModule(primaryModule ?? null, modules);
}

export function getObjectiveSections(
  objective: ObjectiveTab,
  context: ObjectiveNavContext,
  options?: {
    mode?: "dashboard" | "page";
    basePath?: string | null;
    focusSectionId?: string | null;
    inscricoesBasePath?: string | null;
    operationOverride?: OperationModule | null;
  },
): ObjectiveNavSection[] {
  const primaryOperation =
    options?.operationOverride ?? resolvePrimaryOperation(context.primaryModule, context.modules);
  const categoryMeta = PRIMARY_META[primaryOperation];
  const sections: ObjectiveNavSection[] = [];
  const isDashboard = options?.mode === "dashboard";
  const manageBase = options?.basePath ?? null;
  const manageHref = (section: string) => {
    if (manageBase) {
      return section === "eventos" ? manageBase : `${manageBase}?section=${section}`;
    }
    return `/org/manage?section=${section}`;
  };

  if (objective === "create") {
    sections.push({
      id: "overview",
      label: "Dashboard",
      href: "/org/overview",
    });
    sections.push({
      id: "primary",
      label: categoryMeta.createLabel,
      href: categoryMeta.createHref,
    });
    if (hasModule(context.modules, "INSCRICOES")) {
      sections.push({
        id: "inscricoes",
        label: "Formulários",
        href: "/org/inscricoes",
      });
    }
    const focusId = options?.focusSectionId ?? null;
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "manage") {
    const focusId = options?.focusSectionId ?? null;
    const operationOverride = options?.operationOverride ?? null;
    if (focusId === "inscricoes" && hasModule(context.modules, "INSCRICOES")) {
      const listHref = "/org/inscricoes";
      const detailBase = options?.inscricoesBasePath ?? null;
      const canDeepLink = Boolean(detailBase);
      return [
        { id: "inscricoes", label: "Formulários", href: listHref },
        {
          id: "respostas",
          label: "Respostas",
          href: canDeepLink ? `${detailBase}?tab=respostas` : listHref,
          disabled: !canDeepLink,
          badge: canDeepLink ? undefined : "Seleciona",
        },
        {
          id: "definicoes",
          label: "Definições",
          href: canDeepLink ? `${detailBase}?tab=definicoes` : listHref,
          disabled: !canDeepLink,
          badge: canDeepLink ? undefined : "Seleciona",
        },
      ];
    }

    if (operationOverride === "RESERVAS") {
      const baseHref = "/org/reservas";
      sections.push({
        id: "agenda",
        label: "Agenda",
        href: manageBase ?? baseHref,
      });
      sections.push(
        {
          id: "disponibilidade",
          label: "Disponibilidade",
          href: `${baseHref}?tab=availability`,
        },
        {
          id: "servicos",
          label: "Serviços",
          href: `${baseHref}/servicos`,
        },
        {
          id: "clientes",
          label: "Clientes",
          href: `${baseHref}/clientes`,
        },
        {
          id: "profissionais",
          label: "Profissionais",
          href: `${baseHref}/profissionais`,
        },
        {
          id: "recursos",
          label: "Recursos",
          href: `${baseHref}/recursos`,
        },
        {
          id: "politicas",
          label: "Políticas",
          href: `${baseHref}/politicas`,
        },
      );
      if (focusId) {
        const focused = sections.find((section) => section.id === focusId);
        return focused ? [focused] : sections;
      }
      return sections;
    }
    if (operationOverride === "TORNEIOS") {
      const padelClubBase = manageHref(PADEL_CLUB_SECTION);
      const padelTournamentsBase = manageHref(PADEL_TOURNAMENTS_SECTION);
      const withPadelTab = (baseHref: string, tab: string) =>
        `${baseHref}${baseHref.includes("?") ? "&" : "?"}padel=${tab}`;
      const padelClubHref = (tab: string) => withPadelTab(padelClubBase, tab);
      const padelTournamentsHref = (tab: string) => withPadelTab(padelTournamentsBase, tab);
      const torneiosHref = manageHref("eventos");
      sections.push(
        {
          id: "padel-tool-b",
          label: "Torneios de Padel",
          href: padelTournamentsHref("calendar"),
          items: [
            { id: "torneios", label: "Torneios", href: torneiosHref },
            { id: "torneios-criar", label: "Criar torneio", href: categoryMeta.createHref },
            { id: "calendar", label: "Calendário", href: padelTournamentsHref("calendar") },
            { id: "categories", label: "Categorias", href: padelTournamentsHref("categories") },
            { id: "teams", label: "Equipas", href: padelTournamentsHref("teams") },
          ],
        },
        {
          id: "padel-tool-a",
          label: "Gestão de Clube Padel",
          href: padelClubHref("clubs"),
          items: [
            { id: "clubs", label: "Clubes", href: padelClubHref("clubs") },
            { id: "courts", label: "Campos", href: padelClubHref("courts") },
            { id: "players", label: "Jogadores", href: padelClubHref("players") },
            { id: "community", label: "Comunidade", href: padelClubHref("community") },
            { id: "trainers", label: "Treinadores", href: padelClubHref("trainers") },
            { id: "lessons", label: "Aulas", href: padelClubHref("lessons") },
          ],
        },
        {
          id: "padel-jogadores",
          label: "Jogadores",
          href: padelTournamentsHref("players"),
          items: [{ id: "players", label: "Jogadores", href: padelTournamentsHref("players") }],
        },
      );
      if (!isDashboard) {
        sections.push({
          id: "caixa",
          label: "Caixa",
          href: "/org/clube/caixa",
        });
      }
      if (focusId) {
        const focused = sections.find((section) => section.id === focusId);
        return focused ? [focused] : sections;
      }
      return sections;
    }
    if (operationOverride === "EVENTOS") {
      sections.push({
        id: "eventos",
        label: "Eventos",
        href: manageHref("eventos"),
      });
      sections.push({
        id: "create",
        label: categoryMeta.createLabel,
        href: categoryMeta.createHref,
      });
      if (hasModule(context.modules, "INSCRICOES") && focusId === "inscricoes") {
        sections.push({
          id: "inscricoes",
          label: "Formulários",
          href: "/org/inscricoes",
        });
      }
      if (focusId) {
        const focused = sections.find((section) => section.id === focusId);
        return focused ? [focused] : sections;
      }
      return sections;
    }
    sections.push(
      {
        id: "eventos",
        label: "Eventos",
        href: manageHref("eventos"),
      },
      {
        id: "reservas",
        label: "Reservas",
        href: manageHref("reservas"),
      },
      {
        id: "padel-tool-a",
        label: "Gestão de Clube Padel",
        href: manageHref(PADEL_CLUB_SECTION),
      },
      {
        id: "padel-tool-b",
        label: "Torneios de Padel",
        href: manageHref(PADEL_TOURNAMENTS_SECTION),
      },
    );
    if (hasModule(context.modules, "EVENTOS") || hasModule(context.modules, "TORNEIOS")) {
      sections.push({
        id: "checkin",
        label: "Check-in",
        href: "/org/scan",
      });
    }
    if (hasModule(context.modules, "CRM")) {
      sections.push({
        id: "crm",
        label: "CRM",
        href: "/org/crm",
        items: [
          { id: "crm-clientes", label: "Clientes", href: "/org/crm/clientes" },
          { id: "crm-segmentos", label: "Segmentos", href: "/org/crm/segmentos" },
          { id: "crm-campanhas", label: "Campanhas", href: "/org/crm/campanhas" },
          { id: "crm-loyalty", label: "Pontos & recompensas", href: "/org/crm/loyalty" },
        ],
      });
    }
    if (hasModule(context.modules, "INSCRICOES")) {
      sections.push({
        id: "inscricoes",
        label: "Formulários",
        href: "/org/inscricoes",
      });
    }
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "promote") {
    const baseHref = "/org/promote?section=marketing&marketing=";
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
    const focusId = options?.focusSectionId ?? null;
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "profile") {
    const sections = [
      {
        id: "perfil",
        label: "Perfil",
        href: "/org/profile",
      },
    ];
    const focusId = options?.focusSectionId ?? null;
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "analyze") {
    sections.push(
      {
        id: "overview",
        label: "Visão geral",
        href: "/org/analyze?section=overview",
      },
      {
        id: "vendas",
        label: "Vendas",
        href: "/org/analyze?section=vendas",
      },
    );
    sections.push(
      {
        id: "financas",
        label: "Finanças",
        href: "/org/analyze?section=financas",
      },
      {
        id: "invoices",
        label: "Faturação",
        href: "/org/analyze?section=invoices",
      },
      {
        id: "ops",
        label: "Ops Feed",
        href: "/org/analyze?section=ops",
      },
    );
    const focusId = options?.focusSectionId ?? null;
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  return [];
}
