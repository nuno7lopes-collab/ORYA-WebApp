import type { TelemetrySeverity } from "@/domain/telemetry/constants";

export type TelemetryPiiRisk = "LOW" | "MEDIUM" | "HIGH";

export type TelemetryEventContract = {
  eventName: string;
  owner: string;
  description: string;
  defaultSeverity: TelemetrySeverity;
  piiRisk: TelemetryPiiRisk;
};

const CATALOG_ENTRIES: TelemetryEventContract[] = [
  {
    eventName: "checkout_started",
    owner: "commerce",
    description: "Início de checkout no produto.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
  },
  {
    eventName: "checkout_payment_succeeded",
    owner: "commerce",
    description: "Pagamento concluído com sucesso.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
  },
  {
    eventName: "checkout_payment_failed",
    owner: "commerce",
    description: "Falha no pagamento durante checkout.",
    defaultSeverity: "WARN",
    piiRisk: "MEDIUM",
  },
  {
    eventName: "booking_confirmed",
    owner: "bookings",
    description: "Reserva confirmada.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
  },
  {
    eventName: "booking_cancelled",
    owner: "bookings",
    description: "Reserva cancelada.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
  },
  {
    eventName: "auth_success_email",
    owner: "auth",
    description: "Autenticação por email concluída.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
  },
  {
    eventName: "auth_fail_email",
    owner: "auth",
    description: "Falha de autenticação por email.",
    defaultSeverity: "WARN",
    piiRisk: "MEDIUM",
  },
  {
    eventName: "org_dashboard_load_error",
    owner: "org-dashboard",
    description: "Erro ao carregar dashboard da organização.",
    defaultSeverity: "ERROR",
    piiRisk: "LOW",
  },
  {
    eventName: "calendarConflictPreflightMismatchCount",
    owner: "calendar",
    description: "Divergências detectadas em preflight de calendário.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
  },
  {
    eventName: "event_ticket_config_invalid",
    owner: "events",
    description: "Configuração de bilhética inválida.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
  },
];

const CATALOG = new Map(
  CATALOG_ENTRIES.map((item) => [item.eventName, item]),
);

export function resolveTelemetryContract(
  eventName: string,
): TelemetryEventContract | null {
  return CATALOG.get(eventName) ?? null;
}

export function isKnownTelemetryEvent(eventName: string): boolean {
  return CATALOG.has(eventName);
}

export function listTelemetryCatalog(): TelemetryEventContract[] {
  return [...CATALOG_ENTRIES];
}
