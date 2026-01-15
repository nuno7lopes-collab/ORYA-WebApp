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
    createHref: "/organizacao/eventos/novo",
  },
  TORNEIOS: {
    createLabel: "Criar torneio",
    createHref: "/organizacao/torneios/novo",
  },
  RESERVAS: {
    createLabel: "Criar serviço",
    createHref: "/organizacao/reservas?create=service",
  },
};

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
    return `/organizacao?tab=manage&section=${section}`;
  };

  if (objective === "create") {
    sections.push({
      id: "overview",
      label: "Dashboard",
      href: "/organizacao?tab=overview",
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
        href: "/organizacao/inscricoes",
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
      const listHref = "/organizacao/inscricoes";
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
      const baseHref = "/organizacao/reservas";
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
      const padelBase = manageHref("padel-hub");
      const padelHref = (tab: string) => `${padelBase}${padelBase.includes("?") ? "&" : "?"}padel=${tab}`;
      const torneiosHref = manageHref("eventos");
      sections.push(
        {
          id: "torneios",
          label: "Torneios",
          href: torneiosHref,
          items: [
            { id: "torneios", label: "Torneios", href: torneiosHref },
            { id: "torneios-criar", label: "Criar torneio", href: categoryMeta.createHref },
            { id: "categories", label: "Categorias", href: padelHref("categories") },
          ],
        },
        {
          id: "clube",
          label: "Clube",
          href: padelHref("clubs"),
          items: [
            { id: "clubs", label: "Clubes", href: padelHref("clubs") },
            { id: "courts", label: "Campos", href: padelHref("courts") },
          ],
        },
        {
          id: "calendar",
          label: "Calendário",
          href: padelHref("calendar"),
          items: [{ id: "calendar", label: "Jogos", href: padelHref("calendar") }],
        },
        {
          id: "pessoas",
          label: "Pessoas",
          href: padelHref("players"),
          items: [
            { id: "players", label: "Jogadores", href: padelHref("players") },
            { id: "trainers", label: "Treinadores", href: padelHref("trainers") },
          ],
        },
        {
          id: "aulas",
          label: "Aulas",
          href: padelHref("lessons"),
          items: [{ id: "lessons", label: "Aulas", href: padelHref("lessons") }],
        },
      );
      if (!isDashboard) {
        sections.push({
          id: "caixa",
          label: "Caixa",
          href: "/organizacao/clube/caixa",
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
          href: "/organizacao/inscricoes",
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
        id: "padel-hub",
        label: "Padel",
        href: manageHref("padel-hub"),
      },
    );
    if (hasModule(context.modules, "INSCRICOES")) {
      sections.push({
        id: "inscricoes",
        label: "Formulários",
        href: "/organizacao/inscricoes",
      });
    }
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "promote") {
    const baseHref = "/organizacao?tab=promote&section=marketing&marketing=";
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
        href: "/organizacao?tab=profile",
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
        href: "/organizacao?tab=analyze&section=overview",
      },
      {
        id: "vendas",
        label: "Vendas",
        href: "/organizacao?tab=analyze&section=vendas",
      },
    );
    sections.push(
      {
        id: "financas",
        label: "Finanças",
        href: "/organizacao?tab=analyze&section=financas",
      },
      {
        id: "invoices",
        label: "Faturação",
        href: "/organizacao?tab=analyze&section=invoices",
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
