import type { Prisma, PrismaClient } from "@prisma/client";

export const DEFAULT_BOOKING_GRID_MINUTES = 30;
export const BOOKING_DURATION_CATALOG = [30, 60, 90, 120] as const;
export const DEFAULT_BOOKING_ACTIVE_DURATIONS = [60, 90] as const;
export const DEFAULT_BOOKING_ALLOW_CUSTOM_DURATION = false;
export const BOOKING_PRESET_DURATIONS = [...DEFAULT_BOOKING_ACTIVE_DURATIONS] as const;

const DURATION_STEP = 5;

type PolicyTx = Pick<PrismaClient, "organizationSettings"> | Prisma.TransactionClient;

export type BookingGridPolicy = {
  gridMinutes: number;
  allowedDurations: number[];
  allowCustomDuration: false;
};

function getMinutesOfDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function normalizeGridMinutes(raw: unknown) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_BOOKING_GRID_MINUTES;
  const normalized = Math.floor(value);
  if (normalized <= 0 || normalized > 60) return DEFAULT_BOOKING_GRID_MINUTES;
  if (normalized % DURATION_STEP !== 0) return DEFAULT_BOOKING_GRID_MINUTES;
  if (60 % normalized !== 0) return DEFAULT_BOOKING_GRID_MINUTES;
  return normalized;
}

function normalizeActiveDurations(raw: unknown) {
  if (!Array.isArray(raw)) return [...DEFAULT_BOOKING_ACTIVE_DURATIONS];
  const values = Array.from(
    new Set(
      raw
        .map((item) => Number(item))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => BOOKING_DURATION_CATALOG.includes(value as (typeof BOOKING_DURATION_CATALOG)[number])),
    ),
  ).sort((a, b) => a - b);
  if (values.length === 0) return [...DEFAULT_BOOKING_ACTIVE_DURATIONS];
  return values;
}

export function resolveBookingGridPolicy(input: {
  gridMinutes?: unknown;
  allowedDurations?: unknown;
  activeDurations?: unknown;
  allowCustomDuration?: unknown;
}): BookingGridPolicy {
  const rawDurations = Array.isArray(input.activeDurations) ? input.activeDurations : input.allowedDurations;
  return {
    gridMinutes: normalizeGridMinutes(input.gridMinutes),
    allowedDurations: normalizeActiveDurations(rawDurations),
    allowCustomDuration: false,
  };
}

export async function getOrganizationBookingPolicy(params: {
  organizationId: number;
  tx?: PolicyTx;
}): Promise<BookingGridPolicy> {
  const tx = params.tx;
  if (!tx) {
    return {
      gridMinutes: DEFAULT_BOOKING_GRID_MINUTES,
      allowedDurations: [...DEFAULT_BOOKING_ACTIVE_DURATIONS],
      allowCustomDuration: DEFAULT_BOOKING_ALLOW_CUSTOM_DURATION,
    };
  }

  const settings = await tx.organizationSettings.findUnique({
    where: { organizationId: params.organizationId },
    select: {
      bookingGridMinutes: true,
      bookingAllowedDurations: true,
      bookingAllowCustomDuration: true,
    },
  });

  return resolveBookingGridPolicy({
    gridMinutes: settings?.bookingGridMinutes,
    allowedDurations: settings?.bookingAllowedDurations,
    allowCustomDuration: settings?.bookingAllowCustomDuration,
  });
}

export function validateStartAtAgainstPolicy(params: {
  startsAt: Date;
  timezone: string;
  policy: BookingGridPolicy;
}): { ok: true } | { ok: false; errorCode: "INVALID_START_GRID"; message: string } {
  const minutesOfDay = getMinutesOfDay(params.startsAt, params.timezone);
  if (minutesOfDay == null || minutesOfDay % params.policy.gridMinutes !== 0) {
    return {
      ok: false,
      errorCode: "INVALID_START_GRID",
      message: "Horário fora da grelha configurada.",
    };
  }
  return { ok: true };
}

export function validateStartMinuteAgainstPolicy(params: {
  startMinute: number;
  policy: BookingGridPolicy;
}): { ok: true } | { ok: false; errorCode: "INVALID_START_GRID"; message: string } {
  const startMinute = Number.isFinite(params.startMinute) ? Math.floor(params.startMinute) : NaN;
  if (
    !Number.isFinite(startMinute) ||
    startMinute < 0 ||
    startMinute >= 24 * 60 ||
    startMinute % params.policy.gridMinutes !== 0
  ) {
    return {
      ok: false,
      errorCode: "INVALID_START_GRID",
      message: "Horário fora da grelha configurada.",
    };
  }
  return { ok: true };
}

export function validateDurationAgainstPolicy(params: {
  durationMinutes: number;
  policy: BookingGridPolicy;
}): { ok: true } | { ok: false; errorCode: "INVALID_DURATION_POLICY"; message: string } {
  const duration = Number.isFinite(params.durationMinutes) ? Math.floor(params.durationMinutes) : NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      errorCode: "INVALID_DURATION_POLICY",
      message: "Duração inválida para esta organização.",
    };
  }

  if (params.policy.allowedDurations.includes(duration)) {
    return { ok: true };
  }

  return {
    ok: false,
    errorCode: "INVALID_DURATION_POLICY",
    message: "Duração fora da política configurada.",
  };
}

export function validateBookingConfigInput(input: {
  gridMinutes: unknown;
  activeDurations?: unknown;
  allowedDurations?: unknown;
  allowCustomDuration?: unknown;
}):
  | {
      ok: true;
      data: {
        gridMinutes: number;
        activeDurations: number[];
        allowCustomDuration: false;
      };
    }
  | {
      ok: false;
      errorCode: "INVALID_BOOKING_CONFIG";
      message: string;
    } {
  const gridMinutes = Number(input.gridMinutes);
  if (!Number.isFinite(gridMinutes) || Math.floor(gridMinutes) !== gridMinutes) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "gridMinutes inválido.",
    };
  }
  if (gridMinutes <= 0 || gridMinutes > 60 || gridMinutes % DURATION_STEP !== 0 || 60 % gridMinutes !== 0) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "gridMinutes deve ser divisor de 60 e múltiplo de 5.",
    };
  }

  const rawDurations = Array.isArray(input.activeDurations) ? input.activeDurations : input.allowedDurations;
  if (!Array.isArray(rawDurations) || rawDurations.length === 0) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "activeDurations inválido.",
    };
  }

  const activeDurations = Array.from(
    new Set(
      rawDurations
        .map((item) => Number(item))
        .filter((value) => Number.isFinite(value) && Math.floor(value) === value)
        .map((value) => Math.floor(value)),
    ),
  ).sort((a, b) => a - b);

  if (activeDurations.length !== rawDurations.length) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "activeDurations deve conter inteiros únicos.",
    };
  }

  if (
    activeDurations.some(
      (value) => !BOOKING_DURATION_CATALOG.includes(value as (typeof BOOKING_DURATION_CATALOG)[number]),
    )
  ) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "activeDurations tem de ser subconjunto de 30/60/90/120.",
    };
  }

  if (input.allowCustomDuration === true) {
    return {
      ok: false,
      errorCode: "INVALID_BOOKING_CONFIG",
      message: "allowCustomDuration não é permitido para reservas de campos.",
    };
  }

  return {
    ok: true,
    data: {
      gridMinutes,
      activeDurations,
      allowCustomDuration: false,
    },
  };
}
