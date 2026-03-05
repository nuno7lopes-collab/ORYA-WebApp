type RunCategorySummary = {
  categoryId: number | null;
  categoryLabel?: string | null;
  scheduledCount: number;
  skippedCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Em fila",
  RUNNING: "A executar",
  DONE: "Concluído",
  FAILED: "Falhou",
  UNDONE: "Desfeito",
  UNDONE_PARTIAL: "Desfeito parcial",
  UNDO_SKIPPED: "Sem alterações",
};

const STATUS_TONE: Record<string, string> = {
  QUEUED: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  RUNNING: "border-sky-300/35 bg-sky-500/10 text-sky-100",
  DONE: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
  FAILED: "border-rose-300/35 bg-rose-500/10 text-rose-100",
  UNDONE: "border-white/30 bg-white/10 text-white",
  UNDONE_PARTIAL: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  UNDO_SKIPPED: "border-white/20 bg-white/5 text-white/80",
};

export function AutoScheduleRunStatusPanel(props: {
  run: {
    id: string;
    status: string;
    scheduledCount: number;
    skippedCount: number;
    applied?: boolean;
    queued?: boolean;
    errorCode?: string | null;
    byCategory?: RunCategorySummary[];
  } | null;
}) {
  const run = props.run;

  if (!run) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
        <p className="text-sm font-semibold">Última execução</p>
        <p className="mt-2 text-[12px] text-white/65">Sem execução recente.</p>
      </div>
    );
  }

  const status = run.status || "DONE";
  const statusLabel = STATUS_LABEL[status] || status;
  const statusTone =
    STATUS_TONE[status] || "border-white/20 bg-white/5 text-white/80";

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Última execução</p>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-[12px] text-white/70">
        <p>
          {run.scheduledCount} agendados · {run.skippedCount} pendentes
        </p>
        {run.applied === true || run.queued === true ? (
          <div className="flex flex-wrap gap-1 text-[10px]">
            {run.applied === true ? (
              <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
                Aplicado
              </span>
            ) : null}
            {run.queued === true ? (
              <span className="rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">
                Em fila
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {run.errorCode || (run.byCategory ?? []).length > 0 ? (
        <details className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70">
          <summary className="cursor-pointer list-none font-semibold text-white/80">
            Detalhes
          </summary>
          <div className="mt-2 space-y-1">
            <p>ID completo: {run.id}</p>
            {run.errorCode ? (
              <p className="text-rose-100">Erro: {run.errorCode}</p>
            ) : null}
            {(run.byCategory ?? []).slice(0, 4).map((row) => (
              <p key={`run-category-${row.categoryId ?? "global"}`}>
                {row.categoryLabel || row.categoryId || "Global"}:{" "}
                {row.scheduledCount}/{row.scheduledCount + row.skippedCount}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
