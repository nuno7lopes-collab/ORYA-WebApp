import { buildOrgHref } from "@/lib/organizationIdUtils";
import {
  normalizeOrganizationPathname,
  resolveOrganizationTool,
  type OrgToolKey,
} from "@/app/org/_internal/core/topbarRouteUtils";
import {
  resolveSubnavActiveIndex,
  type ToolSubnavItem,
} from "@/app/org/_components/subnav/ToolSubnavShell";

export type OrganizationSidebarAccess = {
  canAccessReservas: boolean;
  canAccessTorneios: boolean;
  canAccessEventos: boolean;
  canAccessInscricoes: boolean;
  canAccessMensagens: boolean;
  canAccessCrm: boolean;
  canAccessAnalytics: boolean;
  canViewFinance: boolean;
  canPromote: boolean;
  canAccessLoja: boolean;
  canManageMembers: boolean;
  canEditOrgSettings: boolean;
};

export type OrganizationNavSubItem = ToolSubnavItem;

export type OrganizationNavTool = {
  id: string;
  toolKey: OrgToolKey;
  label: string;
  href: string;
  items: OrganizationNavSubItem[];
};

export type OrganizationSidebarSectionState = {
  activeToolIndex: number;
  activeSubIndexByToolId: Record<string, number>;
};

function isOnToolPath(normalizedPathname: string | null, basePath: string) {
  if (!normalizedPathname) return false;
  return normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`);
}

function resolveDashboardItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/overview`;
  return [
    {
      id: "daily-summary",
      label: "Visão geral",
      href: buildOrgHref(orgId, "/overview"),
      isActive: ({ normalizedPathname }) => normalizedPathname === basePath,
    },
  ];
}

function resolveCalendarItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = buildOrgHref(orgId, "/calendar");
  return [
    {
      id: "agenda",
      label: "Agenda",
      href: buildOrgHref(orgId, "/calendar", { view: "week" }),
      isActive: ({ normalizedPathname, searchParams }) => {
        if (!normalizedPathname) return false;
        if (normalizedPathname !== basePath && normalizedPathname !== `${basePath}/day`) return false;
        if (normalizedPathname === `${basePath}/day`) return true;
        const view = searchParams.get("view");
        return view === null || view === "day" || view === "week" || view === "month";
      },
    },
    { id: "availability", label: "Disponibilidade", href: buildOrgHref(orgId, "/calendar/availability") },
    { id: "conflicts", label: "Conflitos", href: buildOrgHref(orgId, "/calendar/conflicts") },
  ];
}

function resolveAcademyItems(orgId: number): OrganizationNavSubItem[] {
  return [
    { id: "classes", label: "Aulas", href: buildOrgHref(orgId, "/academy/classes") },
    { id: "trainers", label: "Treinadores", href: buildOrgHref(orgId, "/academy/trainers") },
    { id: "students", label: "Alunos", href: buildOrgHref(orgId, "/academy/students") },
  ];
}

function resolveCheckInItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/check-in`;
  return [
    {
      id: "scanner",
      label: "Scanner",
      href: buildOrgHref(orgId, "/check-in/scanner"),
      isActive: ({ normalizedPathname, searchParams }) => {
        const mode = searchParams.get("mode");
        if (mode) return isOnToolPath(normalizedPathname, basePath) && mode === "scanner";
        return normalizedPathname === basePath || normalizedPathname === `${basePath}/scanner`;
      },
    },
    {
      id: "list",
      label: "Lista",
      href: buildOrgHref(orgId, "/check-in/list"),
      isActive: ({ normalizedPathname, searchParams }) => {
        const mode = searchParams.get("mode");
        if (mode) return isOnToolPath(normalizedPathname, basePath) && mode === "list";
        return normalizedPathname === `${basePath}/list`;
      },
    },
    {
      id: "sessions",
      label: "Sessões",
      href: buildOrgHref(orgId, "/check-in/sessions"),
      isActive: ({ normalizedPathname, searchParams }) => {
        const mode = searchParams.get("mode");
        if (mode) return isOnToolPath(normalizedPathname, basePath) && mode === "sessions";
        return normalizedPathname === `${basePath}/sessions`;
      },
    },
    {
      id: "logs",
      label: "Registos",
      href: buildOrgHref(orgId, "/check-in/logs"),
      isActive: ({ normalizedPathname, searchParams }) => {
        const mode = searchParams.get("mode");
        if (mode) return isOnToolPath(normalizedPathname, basePath) && mode === "logs";
        return normalizedPathname === `${basePath}/logs`;
      },
    },
    {
      id: "devices",
      label: "Dispositivos",
      href: buildOrgHref(orgId, "/check-in/devices"),
      isActive: ({ normalizedPathname, searchParams }) => {
        const mode = searchParams.get("mode");
        if (mode) return isOnToolPath(normalizedPathname, basePath) && mode === "devices";
        return normalizedPathname === `${basePath}/devices`;
      },
    },
  ];
}

function resolvePadelTournamentsItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/padel/tournaments`;
  const resolvePadelTab = (searchParams: URLSearchParams) => {
    const value = searchParams.get("padel");
    if (!value) return "tournaments";
    if (value === "calendar" || value === "categories" || value === "teams" || value === "players") {
      return value;
    }
    return "tournaments";
  };

  return [
    {
      id: "tournaments",
      label: "Torneios",
      href: buildOrgHref(orgId, "/padel/tournaments", {
        tab: "manage",
        section: "padel-tournaments",
        padel: "tournaments",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "tournaments",
    },
    { id: "create", label: "Criar", href: buildOrgHref(orgId, "/padel/tournaments/create") },
    {
      id: "calendar",
      label: "Calendário",
      href: buildOrgHref(orgId, "/padel/tournaments", {
        tab: "manage",
        section: "padel-tournaments",
        padel: "calendar",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "calendar",
    },
    {
      id: "categories",
      label: "Categorias",
      href: buildOrgHref(orgId, "/padel/tournaments", {
        tab: "manage",
        section: "padel-tournaments",
        padel: "categories",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "categories",
    },
    {
      id: "teams",
      label: "Equipas",
      href: buildOrgHref(orgId, "/padel/tournaments", {
        tab: "manage",
        section: "padel-tournaments",
        padel: "teams",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "teams",
    },
    {
      id: "players",
      label: "Jogadores",
      href: buildOrgHref(orgId, "/padel/tournaments", {
        tab: "manage",
        section: "padel-tournaments",
        padel: "players",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "players",
    },
  ];
}

function resolveEventsItems(orgId: number): OrganizationNavSubItem[] {
  return [
    { id: "list", label: "Lista", href: buildOrgHref(orgId, "/events") },
    { id: "new", label: "Novo", href: buildOrgHref(orgId, "/events/new") },
  ];
}

function resolvePadelClubItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/padel/clubs`;
  const resolvePadelTab = (searchParams: URLSearchParams) => {
    const value = searchParams.get("padel");
    if (!value) return "clubs";
    if (value === "partnerships" || value === "players" || value === "coaches" || value === "lessons") {
      return value;
    }
    return "clubs";
  };

  return [
    {
      id: "clubs",
      label: "Clubes",
      href: buildOrgHref(orgId, "/padel/clubs", {
        tab: "manage",
        section: "padel-club",
        padel: "clubs",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "clubs",
    },
    {
      id: "partnerships",
      label: "Parcerias",
      href: buildOrgHref(orgId, "/padel/clubs", {
        tab: "manage",
        section: "padel-club",
        padel: "partnerships",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "partnerships",
    },
    {
      id: "players",
      label: "Jogadores",
      href: buildOrgHref(orgId, "/padel/clubs", {
        tab: "manage",
        section: "padel-club",
        padel: "players",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "players",
    },
    {
      id: "coaches",
      label: "Treinadores",
      href: buildOrgHref(orgId, "/padel/clubs", {
        tab: "manage",
        section: "padel-club",
        padel: "coaches",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "coaches",
    },
    {
      id: "lessons",
      label: "Aulas",
      href: buildOrgHref(orgId, "/padel/clubs", {
        tab: "manage",
        section: "padel-club",
        padel: "lessons",
      }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolvePadelTab(searchParams) === "lessons",
    },
  ];
}

function resolveFormsItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/forms`;
  const resolveFormsSection = (searchParams: URLSearchParams) => {
    const value = searchParams.get("section") ?? searchParams.get("forms");
    if (!value) return "forms";
    if (value === "responses" || value === "settings") return value;
    return "forms";
  };

  return [
    {
      id: "forms",
      label: "Formulários",
      href: buildOrgHref(orgId, "/forms", { section: "forms", view: "ativos" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveFormsSection(searchParams) === "forms",
    },
    {
      id: "responses",
      label: "Respostas",
      href: buildOrgHref(orgId, "/forms", { section: "responses" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveFormsSection(searchParams) === "responses",
    },
    {
      id: "settings",
      label: "Definições",
      href: buildOrgHref(orgId, "/forms", { section: "settings" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveFormsSection(searchParams) === "settings",
    },
  ];
}

function resolveChatItems(orgId: number): OrganizationNavSubItem[] {
  return [
    { id: "inbox", label: "Caixa de entrada", href: buildOrgHref(orgId, "/chat") },
    { id: "communities", label: "Comunidades", href: buildOrgHref(orgId, "/chat/comunidades") },
  ];
}

function resolveCrmItems(orgId: number): OrganizationNavSubItem[] {
  return [
    { id: "customers", label: "Clientes", href: buildOrgHref(orgId, "/crm/customers") },
    { id: "segments", label: "Segmentos", href: buildOrgHref(orgId, "/crm/segments") },
    { id: "campaigns", label: "Campanhas", href: buildOrgHref(orgId, "/crm/campaigns") },
    { id: "journeys", label: "Jornadas", href: buildOrgHref(orgId, "/crm/journeys") },
    { id: "reports", label: "Relatórios", href: buildOrgHref(orgId, "/crm/reports") },
    { id: "loyalty", label: "Fidelização", href: buildOrgHref(orgId, "/crm/loyalty") },
  ];
}

function resolveAnalyticsItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/analytics`;
  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "conversion" ||
      view === "cohorts" ||
      view === "buyers" ||
      view === "time-series" ||
      view === "dimensions" ||
      view === "telemetry"
    ) {
      return view;
    }
    return "overview";
  };

  return [
    {
      id: "overview",
      label: "Resumo",
      href: buildOrgHref(orgId, "/analytics", { view: "overview" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "overview",
    },
    {
      id: "conversion",
      label: "Conversão",
      href: buildOrgHref(orgId, "/analytics", { view: "conversion" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "conversion",
    },
    {
      id: "cohorts",
      label: "Coortes",
      href: buildOrgHref(orgId, "/analytics", { view: "cohorts" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "cohorts",
    },
    {
      id: "buyers",
      label: "Compradores",
      href: buildOrgHref(orgId, "/analytics", { view: "buyers" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "buyers",
    },
    {
      id: "time-series",
      label: "Séries",
      href: buildOrgHref(orgId, "/analytics", { view: "time-series" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "time-series",
    },
    {
      id: "dimensions",
      label: "Dimensões",
      href: buildOrgHref(orgId, "/analytics", { view: "dimensions" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "dimensions",
    },
    {
      id: "telemetry",
      label: "Telemetria",
      href: buildOrgHref(orgId, "/analytics", { view: "telemetry" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "telemetry",
    },
  ];
}

function resolveFinanceItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/finance`;
  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "invoicing" ||
      view === "payouts" ||
      view === "refunds-disputes" ||
      view === "reconciliation" ||
      view === "ledger" ||
      view === "exports" ||
      view === "ops"
    ) {
      return view;
    }
    return "overview";
  };

  return [
    {
      id: "overview",
      label: "Resumo",
      href: buildOrgHref(orgId, "/finance", { view: "overview" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "overview",
    },
    {
      id: "invoicing",
      label: "Faturação",
      href: buildOrgHref(orgId, "/finance", { view: "invoicing" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "invoicing",
    },
    {
      id: "payouts",
      label: "Transferências",
      href: buildOrgHref(orgId, "/finance", { view: "payouts" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "payouts",
    },
    {
      id: "refunds",
      label: "Reembolsos",
      href: buildOrgHref(orgId, "/finance", { view: "refunds-disputes" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "refunds-disputes",
    },
    {
      id: "reconciliation",
      label: "Reconciliação",
      href: buildOrgHref(orgId, "/finance", { view: "reconciliation" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "reconciliation",
    },
    {
      id: "ledger",
      label: "Ledger",
      href: buildOrgHref(orgId, "/finance", { view: "ledger" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "ledger",
    },
    {
      id: "exports",
      label: "Exportações",
      href: buildOrgHref(orgId, "/finance", { view: "exports" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "exports",
    },
    {
      id: "ops",
      label: "Operações",
      href: buildOrgHref(orgId, "/finance", { view: "ops" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "ops",
    },
  ];
}

function resolveMarketingItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/marketing`;
  const resolveMarketing = (searchParams: URLSearchParams) => {
    const value = searchParams.get("marketing");
    if (!value) return "overview";
    if (value === "promos" || value === "content") return value;
    return "overview";
  };

  return [
    {
      id: "overview",
      label: "Resumo",
      href: buildOrgHref(orgId, "/marketing", { marketing: "overview" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveMarketing(searchParams) === "overview",
    },
    {
      id: "promos",
      label: "Promoções",
      href: buildOrgHref(orgId, "/marketing", { marketing: "promos" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveMarketing(searchParams) === "promos",
    },
    {
      id: "content",
      label: "Conteúdo",
      href: buildOrgHref(orgId, "/marketing", { marketing: "content" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveMarketing(searchParams) === "content",
    },
  ];
}

function resolveStoreItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/store`;
  const resolveStoreView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (!view) return "overview";
    if (view === "catalog" || view === "orders" || view === "shipping" || view === "marketing") {
      return view;
    }
    return "overview";
  };

  return [
    {
      id: "overview",
      label: "Visão geral",
      href: buildOrgHref(orgId, "/store", { view: "overview" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveStoreView(searchParams) === "overview",
    },
    {
      id: "catalog",
      label: "Catálogo",
      href: buildOrgHref(orgId, "/store", { view: "catalog" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveStoreView(searchParams) === "catalog",
    },
    {
      id: "orders",
      label: "Encomendas",
      href: buildOrgHref(orgId, "/store", { view: "orders" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveStoreView(searchParams) === "orders",
    },
    {
      id: "shipping",
      label: "Envios",
      href: buildOrgHref(orgId, "/store", { view: "shipping" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveStoreView(searchParams) === "shipping",
    },
    {
      id: "marketing",
      label: "Marketing",
      href: buildOrgHref(orgId, "/store", { view: "marketing" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveStoreView(searchParams) === "marketing",
    },
  ];
}

function resolveTeamItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/team`;
  const resolveTeamView = (searchParams: URLSearchParams) => {
    const value = searchParams.get("staff");
    if (value === "permissoes" || value === "auditoria") return value;
    return "members";
  };

  return [
    {
      id: "members",
      label: "Membros",
      href: buildOrgHref(orgId, "/team"),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveTeamView(searchParams) === "members",
    },
    {
      id: "permissions",
      label: "Permissões",
      href: buildOrgHref(orgId, "/team", { staff: "permissoes" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveTeamView(searchParams) === "permissoes",
    },
    {
      id: "audit",
      label: "Auditoria",
      href: buildOrgHref(orgId, "/team", { staff: "auditoria" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveTeamView(searchParams) === "auditoria",
    },
  ];
}

function resolvePoliciesItems(orgId: number): OrganizationNavSubItem[] {
  const basePath = `/org/${orgId}/policies`;
  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "booking" ||
      view === "crm" ||
      view === "finance" ||
      view === "padel" ||
      view === "terms" ||
      view === "store" ||
      view === "guardrails"
    ) {
      return view;
    }
    return "overview";
  };

  return [
    {
      id: "overview",
      label: "Resumo",
      href: buildOrgHref(orgId, "/policies", { view: "overview" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "overview",
    },
    {
      id: "booking",
      label: "Reservas",
      href: buildOrgHref(orgId, "/policies", { view: "booking" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "booking",
    },
    {
      id: "finance",
      label: "Financeiro",
      href: buildOrgHref(orgId, "/policies", { view: "finance" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "finance",
    },
    {
      id: "crm",
      label: "CRM",
      href: buildOrgHref(orgId, "/policies", { view: "crm" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "crm",
    },
    {
      id: "padel",
      label: "Padel",
      href: buildOrgHref(orgId, "/policies", { view: "padel" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "padel",
    },
    {
      id: "terms",
      label: "Termos",
      href: buildOrgHref(orgId, "/policies", { view: "terms" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "terms",
    },
    {
      id: "store",
      label: "Loja",
      href: buildOrgHref(orgId, "/policies", { view: "store" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "store",
    },
    {
      id: "guardrails",
      label: "Limites",
      href: buildOrgHref(orgId, "/policies", { view: "guardrails" }),
      isActive: ({ normalizedPathname, searchParams }) =>
        isOnToolPath(normalizedPathname, basePath) && resolveView(searchParams) === "guardrails",
    },
  ];
}

function resolveSettingsItems(orgId: number): OrganizationNavSubItem[] {
  return [{ id: "general", label: "Geral", href: buildOrgHref(orgId, "/settings") }];
}

export function buildOrganizationToolNavigation(input: {
  orgId: number;
  access: OrganizationSidebarAccess;
}): OrganizationNavTool[] {
  const { orgId, access } = input;
  const canUseCalendar = access.canAccessReservas || access.canAccessTorneios;

  const tools: Array<OrganizationNavTool | null> = [
    {
      id: "dashboard",
      toolKey: "dashboard",
      label: "Dashboard",
      href: buildOrgHref(orgId, "/overview"),
      items: resolveDashboardItems(orgId),
    },
    canUseCalendar
      ? {
          id: "calendar",
          toolKey: "calendar",
          label: "Calendário",
          href: buildOrgHref(orgId, "/calendar"),
          items: resolveCalendarItems(orgId),
        }
      : null,
    access.canAccessReservas
      ? {
          id: "academy",
          toolKey: "academy",
          label: "Academia",
          href: buildOrgHref(orgId, "/academy/classes"),
          items: resolveAcademyItems(orgId),
        }
      : null,
    access.canAccessTorneios
      ? {
          id: "check-in",
          toolKey: "check-in",
          label: "Check-in",
          href: buildOrgHref(orgId, "/check-in"),
          items: resolveCheckInItems(orgId),
        }
      : null,
    access.canAccessTorneios
      ? {
          id: "padel-tournaments",
          toolKey: "padel-tournaments",
          label: "Torneios",
          href: buildOrgHref(orgId, "/padel/tournaments"),
          items: resolvePadelTournamentsItems(orgId),
        }
      : null,
    access.canAccessEventos
      ? {
          id: "events",
          toolKey: "events",
          label: "Eventos",
          href: buildOrgHref(orgId, "/events"),
          items: resolveEventsItems(orgId),
        }
      : null,
    access.canAccessTorneios
      ? {
          id: "padel-club",
          toolKey: "padel-club",
          label: "Clube",
          href: buildOrgHref(orgId, "/padel/clubs"),
          items: resolvePadelClubItems(orgId),
        }
      : null,
    access.canAccessInscricoes
      ? {
          id: "forms",
          toolKey: "forms",
          label: "Formulários",
          href: buildOrgHref(orgId, "/forms"),
          items: resolveFormsItems(orgId),
        }
      : null,
    access.canAccessMensagens
      ? {
          id: "chat",
          toolKey: "chat",
          label: "Chat",
          href: buildOrgHref(orgId, "/chat"),
          items: resolveChatItems(orgId),
        }
      : null,
    access.canAccessCrm
      ? {
          id: "crm",
          toolKey: "crm",
          label: "CRM",
          href: buildOrgHref(orgId, "/crm/customers"),
          items: resolveCrmItems(orgId),
        }
      : null,
    access.canAccessAnalytics
      ? {
          id: "analytics",
          toolKey: "analytics",
          label: "Analytics",
          href: buildOrgHref(orgId, "/analytics"),
          items: resolveAnalyticsItems(orgId),
        }
      : null,
    access.canViewFinance
      ? {
          id: "finance",
          toolKey: "finance",
          label: "Finanças",
          href: buildOrgHref(orgId, "/finance"),
          items: resolveFinanceItems(orgId),
        }
      : null,
    access.canPromote
      ? {
          id: "marketing",
          toolKey: "marketing",
          label: "Marketing",
          href: buildOrgHref(orgId, "/marketing"),
          items: resolveMarketingItems(orgId),
        }
      : null,
    access.canAccessLoja
      ? {
          id: "store",
          toolKey: "store",
          label: "Loja",
          href: buildOrgHref(orgId, "/store"),
          items: resolveStoreItems(orgId),
        }
      : null,
    access.canManageMembers
      ? {
          id: "team",
          toolKey: "team",
          label: "Equipa",
          href: buildOrgHref(orgId, "/team"),
          items: resolveTeamItems(orgId),
        }
      : null,
    access.canEditOrgSettings
      ? {
          id: "policies",
          toolKey: "policies",
          label: "Políticas",
          href: buildOrgHref(orgId, "/policies"),
          items: resolvePoliciesItems(orgId),
        }
      : null,
    access.canEditOrgSettings
      ? {
          id: "settings",
          toolKey: "settings",
          label: "Definições",
          href: buildOrgHref(orgId, "/settings"),
          items: resolveSettingsItems(orgId),
        }
      : null,
  ];

  return tools.filter((tool): tool is OrganizationNavTool => Boolean(tool));
}

export function resolveOrganizationSidebarState(input: {
  tools: OrganizationNavTool[];
  pathname: string | null;
  searchParams: URLSearchParams;
}): OrganizationSidebarSectionState {
  const normalizedPathname = normalizeOrganizationPathname(input.pathname);
  const activeTool = resolveOrganizationTool(input.pathname);
  const rawActiveSubIndexByToolId: Record<string, number> = {};

  input.tools.forEach((tool) => {
    const { activeIndex } = resolveSubnavActiveIndex({
      items: tool.items,
      pathname: input.pathname,
      normalizedPathname,
      searchParams: input.searchParams,
    });
    rawActiveSubIndexByToolId[tool.id] = activeIndex;
  });

  let activeToolIndex = input.tools.findIndex((tool) => tool.toolKey === activeTool);
  if (activeToolIndex < 0) {
    activeToolIndex = input.tools.findIndex((tool) => (rawActiveSubIndexByToolId[tool.id] ?? -1) >= 0);
  }
  if (activeToolIndex < 0) {
    activeToolIndex = input.tools.length > 0 ? 0 : -1;
  }

  const activeSubIndexByToolId: Record<string, number> = {};
  input.tools.forEach((tool, index) => {
    activeSubIndexByToolId[tool.id] = index === activeToolIndex ? (rawActiveSubIndexByToolId[tool.id] ?? -1) : -1;
  });

  return {
    activeToolIndex,
    activeSubIndexByToolId,
  };
}
