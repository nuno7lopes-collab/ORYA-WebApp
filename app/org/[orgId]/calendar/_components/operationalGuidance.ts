import { buildOrgHref } from "@/lib/organizationIdUtils";
import type { OrganizationOperationalMode } from "@/lib/organizationOperationalMode";

export type CalendarOperationalCapabilities = {
  reservas?: boolean;
  eventos?: boolean;
  torneios?: boolean;
} | null | undefined;

export type CalendarOperationalAction = {
  id: string;
  label: string;
  href: string;
  tone: "primary" | "secondary";
};

export type CalendarOperationalGuidance = {
  mode: OrganizationOperationalMode | "UNKNOWN";
  badge: string;
  title: string;
  description: string;
  selectionHint: string;
  footerHint: string;
  actions: CalendarOperationalAction[];
};

function capabilityEnabled(value: boolean | undefined, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function pushAction(
  actions: CalendarOperationalAction[],
  action: CalendarOperationalAction,
) {
  if (actions.some((entry) => entry.id === action.id)) return;
  actions.push(action);
}

export function buildCalendarOperationalGuidance(input: {
  organizationId: number;
  operationalMode?: OrganizationOperationalMode | null;
  capabilities?: CalendarOperationalCapabilities;
}): CalendarOperationalGuidance {
  const { organizationId, operationalMode, capabilities } = input;
  const allowReservas = capabilityEnabled(capabilities?.reservas, false);
  const allowEventos = capabilityEnabled(capabilities?.eventos, true);
  const allowTorneios = capabilityEnabled(capabilities?.torneios, true);

  const actions: CalendarOperationalAction[] = [];

  if (operationalMode === "EVENT_DRIVEN") {
    if (allowEventos) {
      pushAction(actions, {
        id: "create-event",
        label: "Criar evento",
        href: buildOrgHref(organizationId, "/events/new"),
        tone: "primary",
      });
    }
    if (allowTorneios) {
      pushAction(actions, {
        id: "create-tournament",
        label: "Criar torneio",
        href: buildOrgHref(organizationId, "/padel/tournaments/create"),
        tone: "secondary",
      });
    }
    return {
      mode: "EVENT_DRIVEN",
      badge: "Modo eventos",
      title: "Agenda por evento/torneio",
      description:
        "Sem setup semanal obrigatório. A ocupação entra no calendário quando crias cada evento ou torneio.",
      selectionHint: "Modo eventos: a agenda nasce quando crias cada evento ou torneio.",
      footerHint: "Para adicionar ocupação neste calendário, cria um evento ou torneio.",
      actions,
    };
  }

  if (operationalMode === "SLOT_DRIVEN") {
    if (allowReservas) {
      pushAction(actions, {
        id: "manage-availability",
        label: "Gerir disponibilidade",
        href: buildOrgHref(organizationId, "/bookings/availability"),
        tone: "primary",
      });
      pushAction(actions, {
        id: "open-operations",
        label: "Abrir operações",
        href: buildOrgHref(organizationId, "/bookings/operations"),
        tone: "secondary",
      });
    }
    return {
      mode: "SLOT_DRIVEN",
      badge: "Modo reservas",
      title: "Agenda por slots",
      description:
        "A disponibilidade semanal é a base da operação. Usa escopos para profissionais e recursos quando precisares.",
      selectionHint: "Sem seleção ativa: vista geral consolidada de reservas.",
      footerHint: "A disponibilidade semanal é a fonte de verdade para serviços com slots.",
      actions,
    };
  }

  if (operationalMode === "HYBRID") {
    if (allowReservas) {
      pushAction(actions, {
        id: "manage-availability",
        label: "Gerir disponibilidade",
        href: buildOrgHref(organizationId, "/bookings/availability"),
        tone: "primary",
      });
    }
    if (allowEventos) {
      pushAction(actions, {
        id: "create-event",
        label: "Criar evento",
        href: buildOrgHref(organizationId, "/events/new"),
        tone: "secondary",
      });
    } else if (allowTorneios) {
      pushAction(actions, {
        id: "create-tournament",
        label: "Criar torneio",
        href: buildOrgHref(organizationId, "/padel/tournaments/create"),
        tone: "secondary",
      });
    } else if (allowReservas) {
      pushAction(actions, {
        id: "open-operations",
        label: "Abrir operações",
        href: buildOrgHref(organizationId, "/bookings/operations"),
        tone: "secondary",
      });
    }
    return {
      mode: "HYBRID",
      badge: "Modo híbrido",
      title: "Eventos e reservas",
      description:
        "Eventos entram diretamente no calendário; disponibilidade aplica-se apenas a serviços com reservas por slots.",
      selectionHint: "Sem seleção ativa: vista geral consolidada de eventos e reservas.",
      footerHint:
        "Configura disponibilidade apenas para serviços com reservas. Eventos e torneios pontuais não dependem dela.",
      actions,
    };
  }

  if (allowReservas) {
    pushAction(actions, {
      id: "manage-availability",
      label: "Gerir disponibilidade",
      href: buildOrgHref(organizationId, "/bookings/availability"),
      tone: "primary",
    });
  }
  if (allowEventos) {
    pushAction(actions, {
      id: "create-event",
      label: "Criar evento",
      href: buildOrgHref(organizationId, "/events/new"),
      tone: "secondary",
    });
  }

  return {
    mode: "UNKNOWN",
    badge: "Modo operacional",
    title: "Agenda consolidada",
    description: "Ajusta os filtros e o tipo de operação para visualizar a tua agenda de forma clara.",
    selectionHint: "Sem seleção ativa: vista geral consolidada.",
    footerHint: "Ativa as ferramentas necessarias para desbloquear acoes contextuais nesta agenda.",
    actions,
  };
}
