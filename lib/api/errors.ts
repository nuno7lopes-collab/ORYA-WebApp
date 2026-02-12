export type CanonicalApiErrorBase = {
  errorCode: string;
  message: string;
  retryable: boolean;
  nextAction?: string | null;
  details?: Record<string, unknown> | null;
};

export type CanonicalApiErrorInput = Omit<CanonicalApiErrorBase, "retryable"> & {
  retryable?: boolean;
};

export type CanonicalApiError = CanonicalApiErrorBase & {
  correlationId: string;
};
