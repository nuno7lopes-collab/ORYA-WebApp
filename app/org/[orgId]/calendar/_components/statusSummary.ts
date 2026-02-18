type StatusBucket = "confirmed" | "pending" | "cancelled" | "disputed" | "other";

export type CalendarStatusSummary = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  disputed: number;
  other: number;
};

function resolveStatusBucket(rawStatus: string): StatusBucket {
  const normalized = rawStatus.trim().toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "COMPLETED") return "confirmed";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "pending";
  if (normalized === "DISPUTED") return "disputed";
  if (normalized.startsWith("CANCELLED") || normalized === "NO_SHOW") return "cancelled";
  return "other";
}

export function summarizeAgendaItemsByStatus<T extends { status: string }>(items: T[]): CalendarStatusSummary {
  const summary: CalendarStatusSummary = {
    total: items.length,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    disputed: 0,
    other: 0,
  };
  items.forEach((item) => {
    const bucket = resolveStatusBucket(item.status);
    summary[bucket] += 1;
  });
  return summary;
}
