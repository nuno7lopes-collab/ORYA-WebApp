export function DiagnosticsPanel(props: {
  warnings?: string[];
  conflictsCount?: number;
  byCategory?: Array<{
    categoryId: number | null;
    categoryLabel?: string | null;
    scheduledCount: number;
    skippedCount: number;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">Diagnóstico</p>
      <div className="mt-2 space-y-1 text-[12px] text-white/70">
        <p>Conflitos: {props.conflictsCount ?? 0}</p>
        {(props.byCategory ?? []).map((row) => (
          <p key={`diag-${row.categoryId ?? "global"}`}>
            Categoria {row.categoryLabel || row.categoryId || "global"}: {row.scheduledCount} agendados · {row.skippedCount} pendentes
          </p>
        ))}
        {(props.warnings ?? []).slice(0, 3).map((warning, idx) => (
          <p key={`warn-${idx}`} className="text-amber-100">{warning}</p>
        ))}
      </div>
    </div>
  );
}
