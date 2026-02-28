export const PaymentSubject = {
  BOOKING: "BOOKING",
  EVENT_TICKET: "EVENT_TICKET",
  STORE_ORDER: "STORE_ORDER",
  PADEL_REGISTRATION: "PADEL_REGISTRATION",
} as const;

export type PaymentSubject = (typeof PaymentSubject)[keyof typeof PaymentSubject];

export type AppError = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export type Result<T, E = AppError> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
