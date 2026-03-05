type CalendarKind = "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";
type ToneBucket = "confirmed" | "pending" | "disputed" | "cancelled" | "other";
export function resolveToneBucket(status: string): ToneBucket {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "COMPLETED")
    return "confirmed";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION")
    return "pending";
  if (normalized === "DISPUTED") return "disputed";
  if (normalized.startsWith("CANCELLED") || normalized === "NO_SHOW")
    return "cancelled";
  return "other";
}
export function resolveAggregateToneBucket(
  statuses: string[],
): "confirmed" | "pending" | "disputed" | "cancelled" | "other" {
  const buckets = statuses.map(resolveToneBucket);
  if (buckets.includes("confirmed")) return "confirmed";
  if (buckets.includes("pending")) return "pending";
  if (buckets.includes("disputed")) return "disputed";
  if (buckets.length > 0 && buckets.every((bucket) => bucket === "cancelled"))
    return "cancelled";
  return "other";
}
export function resolveBucketToneClass(bucket: ToneBucket) {
  if (bucket === "confirmed") {
    return "border-sky-300/70 bg-sky-400/20";
  }
  if (bucket === "pending") {
    return "border-amber-300/75 bg-amber-400/22";
  }
  if (bucket === "disputed") {
    return "border-fuchsia-300/75 bg-fuchsia-400/20";
  }
  if (bucket === "cancelled") {
    return "border-rose-300/70 bg-rose-500/20";
  }
  return "border-white/35 bg-slate-400/18";
}
export function resolveEventToneClass(params: {
  status: string;
  kind: CalendarKind;
}) {
  const bucket = resolveToneBucket(params.status);
  if (bucket !== "other") {
    return resolveBucketToneClass(bucket);
  }
  if (params.kind === "TOURNAMENT") {
    return "border-cyan-300/70 bg-cyan-400/20";
  }
  if (params.kind === "EVENT") {
    return "border-indigo-300/70 bg-indigo-400/20";
  }
  if (params.kind === "CLASS") {
    return "border-violet-300/70 bg-violet-400/20";
  }
  return resolveBucketToneClass("confirmed");
}
export function resolveAggregateItemsToneClass(
  items: Array<{ status: string; kind: CalendarKind }>,
) {
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
