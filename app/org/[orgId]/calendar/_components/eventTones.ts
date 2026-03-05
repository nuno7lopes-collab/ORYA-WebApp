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
    return "border-emerald-300/85 bg-emerald-400/30 shadow-[0_8px_20px_rgba(16,185,129,0.24)]";
  }
  if (bucket === "pending") {
    return "border-amber-300/85 bg-amber-400/30 shadow-[0_8px_20px_rgba(245,158,11,0.22)]";
  }
  if (bucket === "disputed") {
    return "border-fuchsia-300/85 bg-fuchsia-400/28 shadow-[0_8px_20px_rgba(232,121,249,0.22)]";
  }
  if (bucket === "cancelled") {
    return "border-rose-300/85 bg-rose-500/28 shadow-[0_8px_20px_rgba(244,63,94,0.2)]";
  }
  return "border-white/45 bg-slate-400/24 shadow-[0_8px_20px_rgba(148,163,184,0.18)]";
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
    return "border-cyan-300/80 bg-cyan-400/26 shadow-[0_8px_20px_rgba(34,211,238,0.2)]";
  }
  if (params.kind === "EVENT") {
    return "border-indigo-300/80 bg-indigo-400/26 shadow-[0_8px_20px_rgba(129,140,248,0.2)]";
  }
  if (params.kind === "CLASS") {
    return "border-violet-300/80 bg-violet-400/26 shadow-[0_8px_20px_rgba(167,139,250,0.2)]";
  }
  if (params.kind === "RESERVATION") {
    return "border-cyan-300/85 bg-cyan-400/30 shadow-[0_8px_20px_rgba(34,211,238,0.22)]";
  }
  return resolveBucketToneClass("other");
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
