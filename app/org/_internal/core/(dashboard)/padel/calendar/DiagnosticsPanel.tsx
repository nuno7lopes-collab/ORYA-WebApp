export function DiagnosticsPanel(props: {
  warnings?: string[];
  conflictsCount?: number;
  occupancyLegend?: Array<{
    type: "HARD_BLOCK" | "CLASS_SESSION" | "MATCH" | "BOOKING" | "SOFT_BLOCK";
    priority: number;
    isBlocking: boolean;
    label: string;
    description?: string | null;
  }>;
  arbitrationPolicy?: {
    algorithm?: string | null;
    priorityRuleVersion?: string | null;
    tieBreak?: string | null;
    note?: string | null;
  } | null;
  byCategory?: Array<{
    categoryId: number | null;
    categoryLabel?: string | null;
    scheduledCount: number;
    skippedCount: number;
  }>;
}) {
  const warnings = props.warnings ?? [];
  const warningCount = warnings.length;
  const conflictsCount = Number(props.conflictsCount ?? 0);
  const policyLabel =
    props.arbitrationPolicy?.algorithm === "first_confirmed_wins_then_priority"
      ? "first_confirmed_wins + prioridade canónica"
      : (props.arbitrationPolicy?.algorithm ?? null);
  const occupancyLegend = props.occupancyLegend ?? [];
  const visibleLegend = occupancyLegend.slice(0, 5);
  const hiddenLegendCount = Math.max(0, occupancyLegend.length - visibleLegend.length);
  const hasTechDetails =
    Boolean(policyLabel) ||
    Boolean(props.arbitrationPolicy?.note) ||
    occupancyLegend.length > 0 ||
    (props.byCategory?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">Estado</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/80">
          Conflitos {conflictsCount}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 ${
            warningCount > 0
              ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
              : "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          Alertas {warningCount}
        </span>
      </div>
      {warnings[0] ? (
        <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
          {warnings[0]}
        </p>
      ) : null}

      {hasTechDetails ? (
        <details className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70">
          <summary className="cursor-pointer list-none font-semibold text-white/80">
            Detalhes
          </summary>
          <div className="mt-2 space-y-1">
            {policyLabel ? (
              <p>
                Arbitragem: {policyLabel}
                {props.arbitrationPolicy?.priorityRuleVersion
                  ? ` · regra ${props.arbitrationPolicy.priorityRuleVersion}`
                  : ""}
              </p>
            ) : null}
            {visibleLegend.map((item) => (
              <p key={`legend-${item.type}`}>
                P{item.priority} · {item.label} ({item.type}) ·{" "}
                {item.isBlocking ? "bloqueante" : "informativo"}
              </p>
            ))}
            {hiddenLegendCount > 0 ? (
              <p className="text-white/55">+{hiddenLegendCount} tipos adicionais</p>
            ) : null}
            {props.arbitrationPolicy?.note ? (
              <p className="text-white/55">{props.arbitrationPolicy.note}</p>
            ) : null}
            {(props.byCategory ?? []).map((row) => (
              <p key={`diag-${row.categoryId ?? "global"}`}>
                {row.categoryLabel || row.categoryId || "Global"}:{" "}
                {row.scheduledCount}/{row.scheduledCount + row.skippedCount}
              </p>
            ))}
            {warnings.slice(1, 3).map((warning, idx) => (
              <p key={`warn-extra-${idx}`} className="text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
