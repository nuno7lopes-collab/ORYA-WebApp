import {
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET,
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULES,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import { normalizeOrganizationUiRole } from "@/lib/organizationUiPermissions";

const DASHBOARD_TOOL_IDS = [
  "eventos",
  "reservas",
  "academia",
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

const LEGACY_HIDDEN_MODULE_KEYS = new Set<OrganizationModule>(["EVENTOS"]);

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

export type DashboardToolFlow =
  | "Operação"
  | "Competição"
  | "Academia"
  | "Comunidade"
  | "Clube"
  | "Negócio"
  | "Configurações";

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
    title: "Competições",
    summary: "Torneios, ligas e resultados do clube.",
    bullets: ["Calendário competitivo", "Participantes e check-in", "Resultados e rankings"],
    flow: "Competição",
    unlocks: ["eventos", "checkin"],
  },
  {
    moduleKey: "RESERVAS",
    iconKey: "TOOL_RESERVAS",
    title: "Operação de Clube",
    summary: "Gestão diária de campos, aulas e serviços.",
    bullets: ["Campos e disponibilidade", "Aulas e serviços", "Calendário operacional"],
    flow: "Operação",
    unlocks: ["reservas", "calendar"],
  },
  {
    moduleKey: "TORNEIOS",
    iconKey: "TOOL_PADEL_TORNEIOS",
    title: "Competição Padel",
    summary: "Gestão de torneios, categorias, equipas e rankings.",
    bullets: ["Torneios e ligas", "Categorias e equipas", "Resultados e classificação"],
    flow: "Competição",
    unlocks: ["padel-club", "padel-tournaments", "checkin"],
  },
  {
    moduleKey: "INSCRICOES",
    iconKey: "TOOL_FORMULARIOS",
    title: "Inscrições",
    summary: "Gestão de inscrições do clube.",
    bullets: ["Formulários", "Listas e vagas", "Exportação de dados"],
    flow: "Competição",
    unlocks: ["inscricoes"],
  },
  {
    moduleKey: "MENSAGENS",
    iconKey: "TOOL_CHAT_INTERNO",
    title: "Comunidade",
    summary: "Mensagens e comunidades internas.",
    bullets: ["Conversas", "Comunidades", "Histórico"],
    flow: "Comunidade",
    unlocks: ["mensagens"],
  },
  {
    moduleKey: "LOJA",
    iconKey: "TOOL_LOJA",
    title: "Loja",
    summary: "Catálogo, checkout e encomendas.",
    bullets: ["Catálogo", "Portes e descontos", "Encomendas e envio"],
    flow: "Clube",
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
  return DASHBOARD_TOOL_ACTIVATION_CATALOG.filter(
    (card) => !LEGACY_HIDDEN_MODULE_KEYS.has(card.moduleKey) && !enabledSet.has(card.moduleKey),
  );
}

export function getEnabledDashboardToolActivationCards(
  enabledTools: string[],
): DashboardToolActivationCard[] {
  const enabledSet = resolveEnabledToolSet(enabledTools);
  return DASHBOARD_TOOL_ACTIVATION_CATALOG.filter(
    (card) => !LEGACY_HIDDEN_MODULE_KEYS.has(card.moduleKey) && enabledSet.has(card.moduleKey),
  );
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
