import { z } from "zod";
import type { TelemetrySeverity } from "@/domain/telemetry/constants";

export type TelemetryPiiRisk = "LOW" | "MEDIUM" | "HIGH";

const TELEMETRY_EVENT_NAME_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+){2,7}$/;
const payloadObjectSchema = z.object({}).passthrough();

export type TelemetryEventContract = {
  eventName: string;
  eventVersion: string;
  owner: string;
  description: string;
  defaultSeverity: TelemetrySeverity;
  piiRisk: TelemetryPiiRisk;
  payloadSchema: z.ZodType<Record<string, unknown>>;
  aliases: string[];
};

type TelemetryEventContractInput = Omit<TelemetryEventContract, "aliases"> & {
  aliases?: string[];
};

const CATALOG_ENTRIES_INPUT: TelemetryEventContractInput[] = [
  {
    eventName: "auth.screen.view",
    eventVersion: "1.0.0",
    aliases: ["auth_screen_view"],
    owner: "auth",
    description: "Visualização de ecrã de autenticação.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.email.tapped",
    eventVersion: "1.0.0",
    aliases: ["auth_tap_email"],
    owner: "auth",
    description: "Toque na opção de autenticação por email.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.email.started",
    eventVersion: "1.0.0",
    aliases: ["auth_start_email"],
    owner: "auth",
    description: "Início do fluxo de autenticação por email.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.email.succeeded",
    eventVersion: "1.0.0",
    aliases: ["auth_success_email"],
    owner: "auth",
    description: "Autenticação por email concluída com sucesso.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.email.failed",
    eventVersion: "1.0.0",
    aliases: ["auth_fail_email"],
    owner: "auth",
    description: "Falha em autenticação por email.",
    defaultSeverity: "WARN",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.apple.tapped",
    eventVersion: "1.0.0",
    aliases: ["auth_tap_apple"],
    owner: "auth",
    description: "Toque no botão de autenticação Apple.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.apple.started",
    eventVersion: "1.0.0",
    aliases: ["auth_start_apple"],
    owner: "auth",
    description: "Início de autenticação Apple.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.apple.succeeded",
    eventVersion: "1.0.0",
    aliases: ["auth_success_apple"],
    owner: "auth",
    description: "Autenticação Apple concluída.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.apple.cancelled",
    eventVersion: "1.0.0",
    aliases: ["auth_cancel_apple"],
    owner: "auth",
    description: "Autenticação Apple cancelada.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.google.tapped",
    eventVersion: "1.0.0",
    aliases: ["auth_tap_google"],
    owner: "auth",
    description: "Toque no botão de autenticação Google.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.google.started",
    eventVersion: "1.0.0",
    aliases: ["auth_start_google"],
    owner: "auth",
    description: "Início de autenticação Google.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.google.succeeded",
    eventVersion: "1.0.0",
    aliases: ["auth_success_google"],
    owner: "auth",
    description: "Autenticação Google concluída.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "auth.google.cancelled",
    eventVersion: "1.0.0",
    aliases: ["auth_cancel_google"],
    owner: "auth",
    description: "Autenticação Google cancelada.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.flow.started",
    eventVersion: "1.0.0",
    aliases: ["checkout_started"],
    owner: "commerce",
    description: "Início de checkout.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.payment.succeeded",
    eventVersion: "1.0.0",
    aliases: ["checkout_payment_succeeded"],
    owner: "commerce",
    description: "Pagamento concluído com sucesso.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.payment.failed",
    eventVersion: "1.0.0",
    aliases: ["checkout_payment_failed"],
    owner: "commerce",
    description: "Falha no pagamento durante checkout.",
    defaultSeverity: "WARN",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.payment.confirmed",
    eventVersion: "1.0.0",
    aliases: ["checkout_payment_confirmed"],
    owner: "commerce",
    description: "Confirmação de pagamento.",
    defaultSeverity: "INFO",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.payment.blocked",
    eventVersion: "1.0.0",
    aliases: ["checkout_payment_blocked"],
    owner: "commerce",
    description: "Pagamento bloqueado por política/estado.",
    defaultSeverity: "WARN",
    piiRisk: "MEDIUM",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.paymentsheet.opened",
    eventVersion: "1.0.0",
    aliases: ["checkout_payment_sheet_opened"],
    owner: "commerce",
    description: "Abertura de payment sheet.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.method.changed",
    eventVersion: "1.0.0",
    aliases: ["checkout_method_changed"],
    owner: "commerce",
    description: "Alteração de método de pagamento.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.action.recovered",
    eventVersion: "1.0.0",
    aliases: ["checkout_requires_action_recovered"],
    owner: "commerce",
    description: "Recuperação de fluxo requires_action.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.timeout.stuck",
    eventVersion: "1.0.0",
    aliases: ["checkout_stuck_timeout"],
    owner: "commerce",
    description: "Timeout por checkout preso.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "checkout.freeticket.confirmed",
    eventVersion: "1.0.0",
    aliases: ["checkout_free_ticket_confirmed"],
    owner: "commerce",
    description: "Confirmação de checkout gratuito.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "booking.status.confirmed",
    eventVersion: "1.0.0",
    aliases: ["booking_confirmed"],
    owner: "bookings",
    description: "Reserva confirmada.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "booking.status.cancelled",
    eventVersion: "1.0.0",
    aliases: ["booking_cancelled"],
    owner: "bookings",
    description: "Reserva cancelada.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "booking.hold.created",
    eventVersion: "1.0.0",
    aliases: ["booking_hold_created"],
    owner: "bookings",
    description: "Hold de reserva criado.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "booking.confirm.timeout",
    eventVersion: "1.0.0",
    aliases: ["booking_confirm_timeout"],
    owner: "bookings",
    description: "Timeout em confirmação de reserva.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.staff.invited",
    eventVersion: "1.0.0",
    aliases: ["organization_staff_invited"],
    owner: "organization",
    description: "Convite de membro para equipa.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.staff.rolechanged",
    eventVersion: "1.0.0",
    aliases: ["organization_staff_role_changed"],
    owner: "organization",
    description: "Alteração de role de membro.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.staff.removed",
    eventVersion: "1.0.0",
    aliases: ["organization_staff_removed"],
    owner: "organization",
    description: "Remoção de membro da equipa.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.staff.inviteaction",
    eventVersion: "1.0.0",
    aliases: ["organization_staff_invite_action"],
    owner: "organization",
    description: "Ação sobre convite de membro.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.tour.next",
    eventVersion: "1.0.0",
    aliases: ["organization_tour_next"],
    owner: "organization",
    description: "Avanço de passo no tour da organização.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "organization.tour.finish",
    eventVersion: "1.0.0",
    aliases: ["organization_tour_finish"],
    owner: "organization",
    description: "Conclusão de tour da organização.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.load.started",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_load_started"],
    owner: "org-dashboard",
    description: "Início de carregamento do dashboard.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.load.retry",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_load_retry"],
    owner: "org-dashboard",
    description: "Retry de carregamento do dashboard.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.load.success",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_load_success"],
    owner: "org-dashboard",
    description: "Carregamento do dashboard concluído.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.load.timeout",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_load_timeout"],
    owner: "org-dashboard",
    description: "Timeout de carregamento do dashboard.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.load.error",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_load_error"],
    owner: "org-dashboard",
    description: "Erro ao carregar dashboard da organização.",
    defaultSeverity: "ERROR",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.module.enabled",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_module_enabled"],
    owner: "org-dashboard",
    description: "Módulo ativado no dashboard.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "org.dashboard.module.disabled",
    eventVersion: "1.0.0",
    aliases: ["org_dashboard_module_disabled"],
    owner: "org-dashboard",
    description: "Módulo desativado no dashboard.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "payments.stripe.connectclicked",
    eventVersion: "1.0.0",
    aliases: ["connect_stripe_clicked"],
    owner: "payments",
    description: "Clique em ligar Stripe.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "event.draft.deleted",
    eventVersion: "1.0.0",
    aliases: ["event_draft_deleted"],
    owner: "events",
    description: "Rascunho de evento removido.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "event.status.cancelled",
    eventVersion: "1.0.0",
    aliases: ["event_cancelled"],
    owner: "events",
    description: "Evento cancelado.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "event.ticketconfig.invalid",
    eventVersion: "1.0.0",
    aliases: ["event_ticket_config_invalid"],
    owner: "events",
    description: "Configuração de bilhética inválida.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "event.tickettypes.missingforprice",
    eventVersion: "1.0.0",
    aliases: ["event_ticket_missing_types_for_price"],
    owner: "events",
    description: "Sem tipos de bilhete para preço configurado.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "explore.filter.price.changed",
    eventVersion: "1.0.0",
    aliases: ["explore_filter_price_changed"],
    owner: "discover",
    description: "Filtro de preço alterado.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "explore.filter.date.changed",
    eventVersion: "1.0.0",
    aliases: ["explore_filter_date_changed"],
    owner: "discover",
    description: "Filtro de data alterado.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "explore.filter.location.changed",
    eventVersion: "1.0.0",
    aliases: ["explore_filter_location_changed"],
    owner: "discover",
    description: "Filtro de localização alterado.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "promo.code.created",
    eventVersion: "1.0.0",
    aliases: ["promo_code_created"],
    owner: "promo",
    description: "Código promocional criado.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "promo.code.deleted",
    eventVersion: "1.0.0",
    aliases: ["promo_code_deleted"],
    owner: "promo",
    description: "Código promocional removido.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "padel.category.tickettype.missing",
    eventVersion: "1.0.0",
    aliases: ["padel_category_missing_ticket_types"],
    owner: "padel",
    description: "Categoria de padel sem tipos de ticket válidos.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "padel.category.ticket.nopurchasable",
    eventVersion: "1.0.0",
    aliases: ["padel_category_no_purchasable_tickets"],
    owner: "padel",
    description: "Categoria de padel sem tickets compráveis.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "padel.calendar.preflight.mismatch",
    eventVersion: "1.0.0",
    aliases: ["calendarConflictPreflightMismatchCount"],
    owner: "calendar",
    description: "Divergências detectadas em preflight de calendário.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "system.log.info",
    eventVersion: "1.0.0",
    owner: "platform",
    description: "Evento técnico de informação emitido pelo logger.",
    defaultSeverity: "INFO",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "system.log.warn",
    eventVersion: "1.0.0",
    owner: "platform",
    description: "Evento técnico de aviso emitido pelo logger.",
    defaultSeverity: "WARN",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
  {
    eventName: "system.log.error",
    eventVersion: "1.0.0",
    owner: "platform",
    description: "Evento técnico de erro emitido pelo logger.",
    defaultSeverity: "ERROR",
    piiRisk: "LOW",
    payloadSchema: payloadObjectSchema,
  },
];

const CATALOG_ENTRIES: TelemetryEventContract[] = CATALOG_ENTRIES_INPUT.map((entry) => ({
  ...entry,
  aliases: entry.aliases ?? [],
}));

const CATALOG = new Map<string, TelemetryEventContract>();
const ALIASES = new Map<string, string>();

for (const entry of CATALOG_ENTRIES) {
  CATALOG.set(entry.eventName, entry);
  ALIASES.set(entry.eventName, entry.eventName);
  for (const alias of entry.aliases) {
    ALIASES.set(alias, entry.eventName);
  }
}

export function normalizeTelemetryEventNameToCatalog(
  eventName: string,
): string | null {
  const normalized = String(eventName ?? "").trim();
  if (!normalized) return null;
  const resolved = ALIASES.get(normalized) ?? null;
  if (resolved) return resolved;
  if (!TELEMETRY_EVENT_NAME_PATTERN.test(normalized)) return null;
  return normalized;
}

export function resolveTelemetryContract(
  eventName: string,
): TelemetryEventContract | null {
  const normalized = normalizeTelemetryEventNameToCatalog(eventName);
  if (!normalized) return null;
  return CATALOG.get(normalized) ?? null;
}

export function isKnownTelemetryEvent(eventName: string): boolean {
  return resolveTelemetryContract(eventName) !== null;
}

export function validateTelemetryContractPayload(
  eventName: string,
  payload: unknown,
) {
  const contract = resolveTelemetryContract(eventName);
  if (!contract) {
    return {
      ok: false as const,
      error: "UNKNOWN_EVENT_CONTRACT",
      normalizedEventName: null,
      contract: null,
    };
  }

  const parsed = contract.payloadSchema.safeParse(
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {},
  );
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "INVALID_EVENT_PAYLOAD_SCHEMA",
      normalizedEventName: contract.eventName,
      contract,
    };
  }

  return {
    ok: true as const,
    normalizedEventName: contract.eventName,
    contract,
  };
}

export function listTelemetryCatalog(): Array<
  Omit<TelemetryEventContract, "payloadSchema">
> {
  return CATALOG_ENTRIES.map((entry) => ({
    eventName: entry.eventName,
    eventVersion: entry.eventVersion,
    owner: entry.owner,
    description: entry.description,
    defaultSeverity: entry.defaultSeverity,
    piiRisk: entry.piiRisk,
    aliases: [...entry.aliases],
  }));
}
