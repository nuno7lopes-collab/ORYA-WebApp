import { resolvePrimaryModule, type OperationModule } from "@/lib/organizationCategories";

export type ObjectiveTab = "create" | "manage" | "promote" | "analyze";

export type ObjectiveNavContext = {
  primaryModule?: string | null;
  tools: string[];
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
    createLabel: "Criar torneio",
    createHref: "/org/padel/tournaments/create",
  },
  TORNEIOS: {
    createLabel: "Criar torneio",
    createHref: "/org/padel/tournaments/create",
  },
  RESERVAS: {
    createLabel: "Criar aula",
    createHref: "/org/academy/classes/new",
  },
};
const PADEL_CLUB_SECTION = "padel-club";
const PADEL_TOURNAMENTS_SECTION = "padel-tournaments";

function hasTool(tools: string[], key: string) {
  return Array.isArray(tools) && tools.includes(key);
}

function resolvePrimaryOperation(primaryModule: string | null | undefined, tools: string[]): OperationModule {
  return resolvePrimaryModule(primaryModule ?? null, tools);
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
    options?.operationOverride ?? resolvePrimaryOperation(context.primaryModule, context.tools);
  const categoryMeta = PRIMARY_META[primaryOperation];
  const sections: ObjectiveNavSection[] = [];
  const manageBase = options?.basePath ?? null;
  const manageHref = (section: string) => {
    if (manageBase) {
      return section === "eventos" ? manageBase : `${manageBase}?section=${section}`;
    }
    if (section === "eventos") return "/org/padel/tournaments";
    if (section === "reservas") return "/org/academy/classes";
    if (section === "inscricoes") return "/org/forms";
    if (section === PADEL_CLUB_SECTION) return "/org/padel/clubs";
    if (section === PADEL_TOURNAMENTS_SECTION) return "/org/padel/tournaments";
    if (section === "staff") return "/org/team";
    if (section === "chat") return "/org/chat";
    if (section === "crm") return "/org/crm/customers";
    return "/org/padel/clubs";
  };

  if (objective === "create") {
    sections.push({
      id: "overview",
      label: "Dashboard Clube",
      href: "/org",
    });
    sections.push({
      id: "primary",
      label: categoryMeta.createLabel,
      href: categoryMeta.createHref,
    });
    if (hasTool(context.tools, "INSCRICOES")) {
      sections.push({
        id: "inscricoes",
        label: "Inscrições",
        href: "/org/forms",
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
    if (focusId === "inscricoes" && hasTool(context.tools, "INSCRICOES")) {
      const listHref = "/org/forms";
      const detailBase = options?.inscricoesBasePath ?? null;
      const canDeepLink = Boolean(detailBase);
      return [
        { id: "inscricoes", label: "Inscrições", href: listHref },
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
      const baseHref = "/org/academy";
      sections.push(
        {
          id: "campos",
          label: "Campos",
          href: `${baseHref}/courts`,
        },
        {
          id: "aulas",
          label: "Aulas",
          href: `${baseHref}`,
        },
      );
      sections.push(
        {
          id: "operacoes",
          label: "Operações",
          href: `${baseHref}/operations`,
        },
        {
          id: "disponibilidade",
          label: "Disponibilidade (calendário)",
          href: "/org/calendar/availability",
        },
        {
          id: "clientes",
          label: "Alunos",
          href: `${baseHref}/students`,
        },
        {
          id: "profissionais",
          label: "Treinadores",
          href: `${baseHref}/trainers`,
        },
        {
          id: "recursos",
          label: "Campos",
          href: `${baseHref}/resources`,
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
      const torneiosHref = padelTournamentsHref("tournaments");
      sections.push(
        {
          id: "padel-tool-b",
          label: "Competição",
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
          label: "Clube",
          href: padelClubHref("clubs"),
          items: [
            { id: "clubs", label: "Clubes", href: padelClubHref("clubs") },
            { id: "partnerships", label: "Parcerias", href: padelClubHref("partnerships") },
            { id: "players", label: "Jogadores", href: padelClubHref("players") },
            { id: "coaches", label: "Treinadores", href: padelClubHref("coaches") },
            { id: "lessons", label: "Aulas", href: padelClubHref("lessons") },
          ],
        },
        {
          id: "padel-jogadores",
          label: "Ranking de jogadores",
          href: padelTournamentsHref("players"),
          items: [{ id: "players", label: "Jogadores", href: padelTournamentsHref("players") }],
        },
      );
      if (focusId) {
        const focused = sections.find((section) => section.id === focusId);
        return focused ? [focused] : sections;
      }
      return sections;
    }
    if (operationOverride === "EVENTOS") {
      sections.push({
        id: "eventos",
        label: "Competição",
        href: "/org/padel/tournaments",
      });
      sections.push({
        id: "create",
        label: categoryMeta.createLabel,
        href: categoryMeta.createHref,
      });
      if (hasTool(context.tools, "INSCRICOES") && focusId === "inscricoes") {
        sections.push({
          id: "inscricoes",
          label: "Inscrições",
          href: "/org/forms",
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
        id: "operacao",
        label: "Operação",
        href: manageHref("reservas"),
        items: [
          { id: "operacao-agenda", label: "Calendário", href: "/org/calendar" },
          { id: "operacao-campos", label: "Campos", href: "/org/bookings/resources" },
          { id: "operacao-checkin", label: "Check-in", href: "/org/check-in" },
          { id: "operacao-aulas", label: "Aulas", href: "/org/academy/classes" },
        ],
      },
      {
        id: "competicao",
        label: "Competição",
        href: manageHref(PADEL_TOURNAMENTS_SECTION),
        items: [
          { id: "competicao-torneios", label: "Torneios", href: "/org/padel/tournaments" },
          { id: "competicao-ranking", label: "Rankings", href: "/org/padel/tournaments?padel=players" },
          { id: "competicao-inscricoes", label: "Inscrições", href: "/org/forms" },
        ],
      },
      {
        id: "academia",
        label: "Academia",
        href: "/org/academy/classes",
        items: [
          { id: "academia-aulas", label: "Aulas", href: "/org/academy/classes" },
          { id: "academia-treinadores", label: "Treinadores", href: "/org/academy/trainers" },
          { id: "academia-alunos", label: "Alunos", href: "/org/academy/students" },
        ],
      },
      {
        id: "comunidade",
        label: "Comunidade",
        href: "/org/chat",
        items: [
          { id: "comunidade-chat", label: "Mensagens", href: "/org/chat" },
          { id: "comunidade-grupos", label: "Comunidades", href: "/org/chat/comunidades" },
        ],
      },
      {
        id: "clube",
        label: "Clube",
        href: manageHref(PADEL_CLUB_SECTION),
        items: [
          { id: "clube-perfil", label: "Perfil público", href: "/org/padel/clubs" },
          { id: "clube-equipa", label: "Equipa", href: "/org/team" },
          { id: "clube-parcerias", label: "Parcerias", href: "/org/padel/parcerias" },
          { id: "clube-loja", label: "Loja", href: "/org/store" },
        ],
      },
      {
        id: "negocio",
        label: "Negócio",
        href: "/org/finance",
        items: [
          { id: "negocio-financas", label: "Finanças", href: "/org/finance" },
          { id: "negocio-analytics", label: "Relatórios & analytics", href: "/org/analytics" },
          { id: "negocio-marketing", label: "Marketing", href: "/org/marketing" },
          { id: "negocio-crm", label: "CRM", href: "/org/crm/customers" },
        ],
      },
      {
        id: "configuracoes",
        label: "Configurações",
        href: "/org/settings",
        items: [
          { id: "configuracoes-politicas", label: "Políticas", href: "/org/policies" },
          { id: "configuracoes-acessos", label: "Permissões", href: "/org/team" },
          { id: "configuracoes-definicoes", label: "Definições", href: "/org/settings" },
          { id: "configuracoes-faturacao", label: "Faturação", href: "/org/finance?view=invoicing" },
        ],
      },
    );
    if (focusId) {
      const focused = sections.find((section) => section.id === focusId);
      return focused ? [focused] : sections;
    }
    return sections;
  }

  if (objective === "promote") {
    const baseHref = "/org/marketing?marketing=";
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

  if (objective === "analyze") {
    sections.push(
      {
        id: "overview",
        label: "Visão geral",
        href: "/org/analytics?view=overview",
      },
      {
        id: "conversion",
        label: "Conversão",
        href: "/org/analytics?view=conversion",
      },
    );
    sections.push(
      {
        id: "finance-overview",
        label: "Finanças",
        href: "/org/finance?view=overview",
      },
      {
        id: "invoicing",
        label: "Faturação",
        href: "/org/finance?view=invoicing",
      },
      {
        id: "ops",
        label: "Feed operacional",
        href: "/org/finance?view=ops",
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
