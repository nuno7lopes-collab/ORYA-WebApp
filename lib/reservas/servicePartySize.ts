import {
  normalizeReservationAssignmentMode,
  requiresPartySizeForAssignmentMode,
} from "@/lib/reservas/serviceAssignment";

export type ServicePartySizeRules = {
  partySizeRequired: boolean;
  partySizeMin: number;
  partySizeMax: number;
  partySizeStep: number;
};

function parsePositiveInt(value: unknown) {
  const parsed =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : null;
}

export function resolveServicePartySizeRules(params: {
  assignmentMode?: string | null;
  serviceKind?: string | null;
  partySizeRequired?: unknown;
  partySizeMin?: unknown;
  partySizeMax?: unknown;
  partySizeStep?: unknown;
}): ServicePartySizeRules {
  const assignmentMode = normalizeReservationAssignmentMode(params.assignmentMode);
  const serviceKind =
    typeof params.serviceKind === "string"
      ? params.serviceKind.trim().toUpperCase()
      : "";
  const requiresPartySize = requiresPartySizeForAssignmentMode(assignmentMode);
  const defaultRequired = requiresPartySize;
  const defaultMin = 1;
  const defaultMax = requiresPartySize
    ? serviceKind === "COURT"
      ? 4
      : 2
    : 1;

  const partySizeRequired =
    typeof params.partySizeRequired === "boolean"
      ? params.partySizeRequired
      : defaultRequired;
  const parsedMin = parsePositiveInt(params.partySizeMin) ?? defaultMin;
  const parsedMax = parsePositiveInt(params.partySizeMax) ?? defaultMax;
  const parsedStep = parsePositiveInt(params.partySizeStep) ?? 1;
  const partySizeMin = Math.max(1, parsedMin);
  const partySizeMax = Math.max(partySizeMin, parsedMax);
  const partySizeStep = Math.max(1, parsedStep);

  return {
    partySizeRequired,
    partySizeMin,
    partySizeMax,
    partySizeStep,
  };
}

export function getServicePartySizeOptions(rules: ServicePartySizeRules) {
  const options: number[] = [];
  for (let value = rules.partySizeMin; value <= rules.partySizeMax; value += rules.partySizeStep) {
    options.push(value);
  }
  if (options[options.length - 1] !== rules.partySizeMax) {
    options.push(rules.partySizeMax);
  }
  return options;
}

export function validateRequestedPartySize(params: {
  requested: number | null;
  rules: ServicePartySizeRules;
}) {
  const { requested, rules } = params;
  if (requested == null) {
    if (!rules.partySizeRequired) {
      return { ok: true as const, partySize: null };
    }
    return {
      ok: false as const,
      errorCode: "CAPACITY_REQUIRED",
      message: "Capacidade obrigatória.",
    };
  }

  if (!Number.isFinite(requested) || requested < 1) {
    return {
      ok: false as const,
      errorCode: "CAPACITY_INVALID",
      message: "Capacidade inválida.",
    };
  }

  const value = Math.round(requested);
  if (value < rules.partySizeMin || value > rules.partySizeMax) {
    return {
      ok: false as const,
      errorCode: "CAPACITY_OUT_OF_RANGE",
      message: `Capacidade fora do intervalo (${rules.partySizeMin}-${rules.partySizeMax}).`,
    };
  }

  if ((value - rules.partySizeMin) % rules.partySizeStep !== 0) {
    return {
      ok: false as const,
      errorCode: "CAPACITY_STEP_INVALID",
      message: `Capacidade inválida para o passo de ${rules.partySizeStep}.`,
    };
  }

  return { ok: true as const, partySize: value };
}
