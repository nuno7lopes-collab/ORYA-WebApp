export const BOOKING_POLICY_WINDOW_MINUTES_MIN = 0;
export const BOOKING_POLICY_WINDOW_MINUTES_MAX = 10080;

export const ORG_RESCHEDULE_WINDOW_MINUTES_DEFAULT = 240;
export const ORG_RESCHEDULE_WINDOW_MINUTES_MIN = 0;
export const ORG_RESCHEDULE_WINDOW_MINUTES_MAX = 10080;

type BookingWindowField = "cancellationWindowMinutes" | "rescheduleWindowMinutes";

type GuardrailError = {
  ok: false;
  errorCode: string;
  message: string;
  details: Record<string, unknown>;
};

type GuardrailSuccess<T> = {
  ok: true;
  value: T;
};

type GuardrailResult<T> = GuardrailError | GuardrailSuccess<T>;

const FIELD_LABELS: Record<BookingWindowField, string> = {
  cancellationWindowMinutes: "cancelamento",
  rescheduleWindowMinutes: "reagendamento",
};

const FIELD_CODES: Record<
  BookingWindowField,
  { invalid: string; outOfRange: string }
> = {
  cancellationWindowMinutes: {
    invalid: "BOOKING_POLICY_CANCELLATION_WINDOW_INVALID",
    outOfRange: "BOOKING_POLICY_CANCELLATION_WINDOW_OUT_OF_RANGE",
  },
  rescheduleWindowMinutes: {
    invalid: "BOOKING_POLICY_RESCHEDULE_WINDOW_INVALID",
    outOfRange: "BOOKING_POLICY_RESCHEDULE_WINDOW_OUT_OF_RANGE",
  },
};

function parseRoundedFinite(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export function clampBookingPolicyWindowMinutes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(
    BOOKING_POLICY_WINDOW_MINUTES_MAX,
    Math.max(BOOKING_POLICY_WINDOW_MINUTES_MIN, Math.round(value)),
  );
}

export function validateBookingPolicyWindowMinutes(params: {
  value: unknown;
  field: BookingWindowField;
  allowNull?: boolean;
}): GuardrailResult<number | null> {
  const { value, field, allowNull = true } = params;
  const label = FIELD_LABELS[field];
  const codes = FIELD_CODES[field];

  if (value === null) {
    if (!allowNull) {
      return {
        ok: false,
        errorCode: codes.invalid,
        message: `O prazo de ${label} não pode ser nulo.`,
        details: { field, value },
      };
    }
    return { ok: true, value: null };
  }

  const rounded = parseRoundedFinite(value);
  if (rounded === null) {
    return {
      ok: false,
      errorCode: codes.invalid,
      message: `O prazo de ${label} tem de ser um número inteiro em minutos.`,
      details: { field, value },
    };
  }

  if (
    rounded < BOOKING_POLICY_WINDOW_MINUTES_MIN ||
    rounded > BOOKING_POLICY_WINDOW_MINUTES_MAX
  ) {
    return {
      ok: false,
      errorCode: codes.outOfRange,
      message: `O prazo de ${label} tem de estar entre ${BOOKING_POLICY_WINDOW_MINUTES_MIN} e ${BOOKING_POLICY_WINDOW_MINUTES_MAX} minutos.`,
      details: {
        field,
        value: rounded,
        min: BOOKING_POLICY_WINDOW_MINUTES_MIN,
        max: BOOKING_POLICY_WINDOW_MINUTES_MAX,
      },
    };
  }

  return { ok: true, value: rounded };
}

export function clampOrgRescheduleWindowMinutes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return ORG_RESCHEDULE_WINDOW_MINUTES_DEFAULT;
  return Math.min(
    ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
    Math.max(ORG_RESCHEDULE_WINDOW_MINUTES_MIN, Math.round(value)),
  );
}

export function validateOrgRescheduleWindowMinutes(value: unknown): GuardrailResult<number> {
  const rounded = parseRoundedFinite(value);
  if (rounded === null) {
    return {
      ok: false,
      errorCode: "ORG_RESCHEDULE_WINDOW_INVALID",
      message: "orgRescheduleWindowMinutes tem de ser um número inteiro em minutos.",
      details: { field: "orgRescheduleWindowMinutes", value },
    };
  }

  if (
    rounded < ORG_RESCHEDULE_WINDOW_MINUTES_MIN ||
    rounded > ORG_RESCHEDULE_WINDOW_MINUTES_MAX
  ) {
    return {
      ok: false,
      errorCode: "ORG_RESCHEDULE_WINDOW_OUT_OF_RANGE",
      message: `orgRescheduleWindowMinutes tem de estar entre ${ORG_RESCHEDULE_WINDOW_MINUTES_MIN} e ${ORG_RESCHEDULE_WINDOW_MINUTES_MAX} minutos.`,
      details: {
        field: "orgRescheduleWindowMinutes",
        value: rounded,
        min: ORG_RESCHEDULE_WINDOW_MINUTES_MIN,
        max: ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
      },
    };
  }

  return { ok: true, value: rounded };
}
