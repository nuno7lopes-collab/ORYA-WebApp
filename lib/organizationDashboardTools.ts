const DASHBOARD_TOOL_IDS = [
  "eventos",
  "reservas",
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
  "settings",
] as const;

export type DashboardToolId = (typeof DASHBOARD_TOOL_IDS)[number];

export const DASHBOARD_TOOL_ID_SET = new Set<string>(DASHBOARD_TOOL_IDS);

export const NON_HIDEABLE_DASHBOARD_TOOL_IDS = new Set<string>([
  "settings",
  "financeiro",
  "staff",
]);

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
