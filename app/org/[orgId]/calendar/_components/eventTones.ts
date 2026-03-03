type CalendarKind = "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";

type ToneBucket = "confirmed" | "pending" | "disputed" | "cancelled" | "other";

export function resolveToneBucket(status: string): ToneBucket {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "COMPLETED") return "confirmed";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "pending";
  if (normalized === "DISPUTED") return "disputed";
  if (normalized.startsWith("CANCELLED") || normalized === "NO_SHOW") return "cancelled";
  return "other";
}

export function resolveAggregateToneBucket(
  statuses: string[],
): "confirmed" | "pending" | "disputed" | "cancelled" | "other" {
  const buckets = statuses.map(resolveToneBucket);
  if (buckets.includes("confirmed")) return "confirmed";
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("disputed")) return "disputed";
  if (buckets.length > 0 && buckets.every((bucket) => bucket === "cancelled")) return "cancelled";
  if (buckets.includes("cancelled")) return "cancelled";
  return "other";
}

export function resolveBucketToneClass(bucket: ToneBucket) {
  if (bucket === "confirmed") {
    return "border-sky-300/60 bg-[linear-gradient(135deg,rgba(56,189,248,0.32),rgba(14,116,144,0.12))]";
  }
  if (bucket === "pending") {
    return "border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.24),rgba(251,191,36,0.08))]";
  }
  if (bucket === "disputed") {
    return "border-fuchsia-200/60 bg-[linear-gradient(135deg,rgba(217,70,239,0.22),rgba(126,34,206,0.1))]";
  }
  if (bucket === "cancelled") {
    return "border-rose-300/60 bg-[linear-gradient(135deg,rgba(244,63,94,0.22),rgba(244,63,94,0.08))]";
  }
  return "border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))]";
}

export function resolveEventToneClass(params: { status: string; kind: CalendarKind }) {
  const bucket = resolveToneBucket(params.status);
  if (bucket !== "other") {
    return resolveBucketToneClass(bucket);
  }
  if (params.kind === "TOURNAMENT") {
    return "border-cyan-200/55 bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(14,116,144,0.1))]";
  }
  if (params.kind === "EVENT") {
    return "border-indigo-200/55 bg-[linear-gradient(135deg,rgba(129,140,248,0.2),rgba(49,46,129,0.12))]";
  }
  if (params.kind === "CLASS") {
    return "border-sky-200/55 bg-[linear-gradient(135deg,rgba(56,189,248,0.2),rgba(14,116,144,0.1))]";
  }
  return resolveBucketToneClass("confirmed");
}

export function resolveAggregateItemsToneClass(items: Array<{ status: string; kind: CalendarKind }>) {
  if (items.length === 0) {
    return resolveBucketToneClass("other");
  }
  const bucket = resolveAggregateToneBucket(items.map((item) => item.status));
  if (bucket !== "other") {
    return resolveBucketToneClass(bucket);
  }
  return resolveEventToneClass({
    status: items[0]?.status ?? "",
    kind: items[0]?.kind ?? "RESERVATION",
  });
}
