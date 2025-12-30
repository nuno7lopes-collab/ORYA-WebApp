type FinanceErrorType = "checkout" | "refund" | "dispute" | "auto_charge";

export function logFinanceError(type: FinanceErrorType, error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[finance:${type}]`, { message: err.message, context });

  const sentry = (globalThis as any)?.Sentry;
  if (sentry?.captureException) {
    sentry.captureException(err, {
      extra: context ?? {},
      tags: { domain: "finance", type },
    });
  }
}
