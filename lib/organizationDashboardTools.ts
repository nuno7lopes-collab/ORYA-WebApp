import {
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET,
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULES,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import { normalizeOrganizationUiRole } from "@/lib/organizationUiPermissions";

const DASHBOARD_TOOL_IDS = [
  "eventos",
  "reservas",
  "calendar",
  "padel-club",
  "padel-tournaments",
  "checkin",
  "inscricoes",
  "mensagens",
  "financeiro",
  "analytics",
  "marketing",
  "crm",
  "loja",
  "staff",
  "politicas",
  "settings",
] as const;

export type DashboardToolId = (typeof DASHBOARD_TOOL_IDS)[number];

export const DASHBOARD_TOOL_ID_SET = new Set<string>(DASHBOARD_TOOL_IDS);

export const NON_HIDEABLE_DASHBOARD_TOOL_IDS = new Set<string>([
  "settings",
  "politicas",
  "financeiro",
  "staff",
  "calendar",
]);

export {
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULES,
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET,
};

export type DashboardToolFlow = "Operações" | "Gestão" | "Administração";

export type DashboardToolActivationCard = {
  moduleKey: OrganizationModule;
  iconKey: string;
  title: string;
  summary: string;
  bullets: string[];
  flow: DashboardToolFlow;
  unlocks: string[];
};

export const DASHBOARD_TOOL_ACTIVATION_CATALOG: DashboardToolActivationCard[] = [
  {
    moduleKey: "EVENTOS",
    iconKey: "TOOL_EVENTOS",
    title: "Eventos",
    summary: "Gestao de eventos publicos e privados.",
    bullets: ["Bilhetes e regras", "Participantes e check-in", "Comunicacao operacional"],
    flow: "Operações",
    unlocks: ["eventos", "checkin"],
  },
  {
    moduleKey: "RESERVAS",
    iconKey: "TOOL_RESERVAS",
    title: "Reservas",
    summary: "Gestao diaria de servicos e marcacoes.",
    bullets: ["Servicos e disponibilidade", "Marcacoes e estados", "Calendario operacional"],
    flow: "Operações",
    unlocks: ["reservas", "calendar"],
  },
  {
    moduleKey: "TORNEIOS",
    iconKey: "TOOL_PADEL_TORNEIOS",
    title: "PADEL",
    summary: "Gestao de clubes, campos e torneios.",
    bullets: ["Clubes e campos", "Torneios e equipas", "Calendario e check-in"],
    flow: "Operações",
    unlocks: ["padel-club", "padel-tournaments", "checkin"],
  },
  {
    moduleKey: "INSCRICOES",
    iconKey: "TOOL_FORMULARIOS",
    title: "Formularios",
    summary: "Formularios e inscricoes.",
    bullets: ["Formularios", "Listas e vagas", "Exportacao de dados"],
    flow: "Operações",
    unlocks: ["inscricoes"],
  },
  {
    moduleKey: "MENSAGENS",
    iconKey: "TOOL_CHAT_INTERNO",
    title: "Mensagens",
    summary: "Comunicacao interna da equipa.",
    bullets: ["Conversas", "Canais", "Historico"],
    flow: "Operações",
    unlocks: ["mensagens"],
  },
  {
    moduleKey: "LOJA",
    iconKey: "TOOL_LOJA",
    title: "Loja",
    summary: "Catalogo, checkout e encomendas.",
    bullets: ["Catalogo", "Portes e descontos", "Encomendas e envio"],
    flow: "Gestão",
    unlocks: ["loja"],
  },
];

function normalizeToolKey(input: string) {
  return input.trim().toUpperCase();
}

function resolveEnabledToolSet(enabledTools: string[]) {
  return new Set(
    enabledTools
      .filter((tool): tool is string => typeof tool === "string")
      .map((tool) => normalizeToolKey(tool))
      .filter((tool) => tool.length > 0),
  );
}

export function getAvailableDashboardToolActivationCards(
  enabledTools: string[],
): DashboardToolActivationCard[] {
  const enabledSet = resolveEnabledToolSet(enabledTools);
  return DASHBOARD_TOOL_ACTIVATION_CATALOG.filter((card) => !enabledSet.has(card.moduleKey));
}

export function getEnabledDashboardToolActivationCards(
  enabledTools: string[],
): DashboardToolActivationCard[] {
  const enabledSet = resolveEnabledToolSet(enabledTools);
  return DASHBOARD_TOOL_ACTIVATION_CATALOG.filter((card) => enabledSet.has(card.moduleKey));
}

export function shouldShowDashboardToolManagerCta(input: {
  canCustomizeTools: boolean;
  hasHiddenTools: boolean;
  canManageTools: boolean;
  hasAvailableToolCards: boolean;
}) {
  return input.canManageTools || (input.canCustomizeTools && input.hasHiddenTools);
}

export function canManageOrganizationTools(role: string | null | undefined) {
  const normalizedRole = normalizeOrganizationUiRole(role);
  return normalizedRole === "OWNER" || normalizedRole === "CO_OWNER" || normalizedRole === "ADMIN";
}

export function sanitizeDashboardHiddenToolIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => DASHBOARD_TOOL_ID_SET.has(value))
    .filter((value) => !NON_HIDEABLE_DASHBOARD_TOOL_IDS.has(value));
  return Array.from(new Set(normalized)).sort();
}
