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
      actions,
    };
  }

  if (operationalMode === "SLOT_DRIVEN") {
    if (allowReservas) {
      pushAction(actions, {
        id: "manage-availability",
        label: "Disponibilidade",
        href: buildOrgHref(organizationId, "/calendar/availability"),
        tone: "primary",
      });
      pushAction(actions, {
        id: "open-operations",
        label: "Operações",
        href: buildOrgHref(organizationId, "/bookings/operations"),
        tone: "secondary",
      });
    }
    return {
      mode: "SLOT_DRIVEN",
      badge: "Modo reservas",
      actions,
    };
  }

  if (operationalMode === "HYBRID") {
    if (allowReservas) {
      pushAction(actions, {
        id: "manage-availability",
        label: "Disponibilidade",
        href: buildOrgHref(organizationId, "/calendar/availability"),
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
        label: "Operações",
        href: buildOrgHref(organizationId, "/bookings/operations"),
        tone: "secondary",
      });
    }
    return {
      mode: "HYBRID",
      badge: "Modo híbrido",
      actions,
    };
  }

  if (allowReservas) {
    pushAction(actions, {
      id: "manage-availability",
      label: "Disponibilidade",
      href: buildOrgHref(organizationId, "/calendar/availability"),
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
    actions,
  };
}
