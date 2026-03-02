import type { OrgToolKey } from "@/app/org/_internal/core/topbarRouteUtils";

export const CLUB_DASHBOARD_AREA_ORDER = [
  "Operação",
  "Competição",
  "Academia",
  "Comunidade",
  "Clube",
  "Negócio",
  "Configurações",
] as const;

export type ClubDashboardArea = (typeof CLUB_DASHBOARD_AREA_ORDER)[number];

export type ClubDashboardViewModel = {
  toolKey: OrgToolKey;
  label: string;
  area: ClubDashboardArea;
};

const CLUB_TOPBAR_LABEL_BY_TOOL: Record<OrgToolKey, string> = {
  dashboard: "Dashboard Clube",
  events: "Eventos",
  academy: "Academia",
  bookings: "Academia",
  calendar: "Calendário",
  "check-in": "Check-in",
  policies: "Políticas",
  finance: "Finanças",
  analytics: "Analytics",
  crm: "CRM",
  store: "Loja",
  forms: "Formulários",
  chat: "Chat",
  team: "Equipa",
  "padel-club": "Clube",
  "padel-tournaments": "Torneios",
  marketing: "Marketing",
  settings: "Definições",
};

const CLUB_AREA_BY_TOOL: Record<OrgToolKey, ClubDashboardArea> = {
  dashboard: "Operação",
  events: "Competição",
  academy: "Academia",
  bookings: "Academia",
  calendar: "Operação",
  "check-in": "Operação",
  policies: "Configurações",
  finance: "Negócio",
  analytics: "Negócio",
  crm: "Negócio",
  store: "Clube",
  forms: "Competição",
  chat: "Comunidade",
  team: "Clube",
  "padel-club": "Clube",
  "padel-tournaments": "Competição",
  marketing: "Negócio",
  settings: "Configurações",
};

const CLUB_AREA_BY_DASHBOARD_TOOL_ID: Record<string, ClubDashboardArea> = {
  events: "Competição",
  eventos: "Competição",
  academy: "Academia",
  reservas: "Operação",
  academia: "Academia",
  calendar: "Operação",
  "check-in": "Operação",
  "padel-club": "Clube",
  "padel-tournaments": "Competição",
  checkin: "Operação",
  forms: "Competição",
  formularios: "Competição",
  inscricoes: "Competição",
  chat: "Comunidade",
  mensagens: "Comunidade",
  finance: "Negócio",
  financeiro: "Negócio",
  analytics: "Negócio",
  marketing: "Negócio",
  crm: "Negócio",
  store: "Clube",
  loja: "Clube",
  team: "Clube",
  staff: "Clube",
  policies: "Configurações",
  politicas: "Configurações",
  settings: "Configurações",
};

export function resolveClubDashboardViewModel(toolKey: OrgToolKey): ClubDashboardViewModel {
  return {
    toolKey,
    label: CLUB_TOPBAR_LABEL_BY_TOOL[toolKey] ?? "Dashboard Clube",
    area: CLUB_AREA_BY_TOOL[toolKey] ?? "Operação",
  };
}

export function resolveClubDashboardAreaByTool(toolKey: OrgToolKey): ClubDashboardArea {
  return CLUB_AREA_BY_TOOL[toolKey] ?? "Operação";
}

export function resolveClubDashboardAreaByToolId(toolId: string): ClubDashboardArea {
  return CLUB_AREA_BY_DASHBOARD_TOOL_ID[toolId] ?? "Operação";
}
