import { logError } from "@/lib/observability/logger";

type FinanceErrorType =
  | "checkout"
  | "refund"
  | "dispute"
  | "auto_charge"
  | "payout"
  | "refund.ledger_append_failed"
  | "dispute.ledger_append_failed";

export function logFinanceError(type: FinanceErrorType, error: unknown, context?: Record<string, unknown>) {
  logError(`finance:${type}`, error, { ...context, domain: "finance", type }, { fallbackToRequestContext: false });
}
