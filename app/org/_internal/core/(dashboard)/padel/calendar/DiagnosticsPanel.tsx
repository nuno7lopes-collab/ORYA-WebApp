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
  const policyLabel =
    props.arbitrationPolicy?.algorithm === "first_confirmed_wins_then_priority"
      ? "first_confirmed_wins + prioridade canónica"
      : (props.arbitrationPolicy?.algorithm ?? null);
  const hasTechDetails =
    Boolean(policyLabel) ||
    Boolean(props.arbitrationPolicy?.note) ||
    (props.occupancyLegend?.length ?? 0) > 0 ||
    (props.byCategory?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">Estado</p>
      <div className="mt-2 space-y-1 text-[12px] text-white/70">
        <p>Conflitos: {props.conflictsCount ?? 0}</p>
        {warningCount > 0 ? (
          <p className="text-amber-100">Alertas: {warningCount}</p>
        ) : (
          <p className="text-emerald-200">Sem alertas ativos.</p>
        )}
        {warnings[0] ? <p className="text-amber-100">{warnings[0]}</p> : null}
      </div>

      {hasTechDetails ? (
        <details className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70">
          <summary className="cursor-pointer list-none font-semibold text-white/80">
            Detalhe técnico
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
            {(props.occupancyLegend ?? []).map((item) => (
              <p key={`legend-${item.type}`}>
                P{item.priority} · {item.label} ({item.type}) ·{" "}
                {item.isBlocking ? "bloqueante" : "informativo"}
              </p>
            ))}
            {props.arbitrationPolicy?.note ? (
              <p className="text-white/55">{props.arbitrationPolicy.note}</p>
            ) : null}
            {(props.byCategory ?? []).map((row) => (
              <p key={`diag-${row.categoryId ?? "global"}`}>
                Categoria {row.categoryLabel || row.categoryId || "global"}:{" "}
                {row.scheduledCount} agendados · {row.skippedCount} pendentes
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
