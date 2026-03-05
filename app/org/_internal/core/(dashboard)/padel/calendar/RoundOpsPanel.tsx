export function RoundOpsPanel(props: {
  categoryLabel: string;
  formatLabel: string;
  roundLabel: string;
  note?: string | null;
  hasRuntime: boolean;
  busy: boolean;
  profileBusy?: boolean;
  onSimulate: () => void;
  onAdvance: () => void;
  message?: string | null;
  warning?: string | null;
  error?: string | null;
}) {
  const disabled = props.busy || props.profileBusy;

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">Operação por rondas</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/80">
          {props.categoryLabel}
        </span>
        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/80">
          {props.formatLabel}
        </span>
        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/80">
          {props.roundLabel}
        </span>
      </div>
      {props.note ? (
        <p className="mt-2 text-[11px] text-white/65">{props.note}</p>
      ) : null}

      {!props.hasRuntime ? (
        <p className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Runtime ainda não iniciado para esta categoria.
        </p>
      ) : null}

      {props.message ? (
        <p className="mt-2 rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          {props.message}
        </p>
      ) : null}
      {props.warning ? (
        <p className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          {props.warning}
        </p>
      ) : null}
      {props.error ? (
        <p className="mt-2 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {props.error}
        </p>
      ) : null}

      <div className="mt-2 grid gap-2">
        <button
          type="button"
          onClick={props.onSimulate}
          disabled={!props.hasRuntime || disabled}
          className="rounded-full border border-white/20 px-3 py-2 text-sm text-white hover:border-white/35 disabled:opacity-50"
        >
          {props.busy ? "A processar..." : "Simular"}
        </button>
        <button
          type="button"
          onClick={props.onAdvance}
          disabled={!props.hasRuntime || disabled}
          className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {props.busy ? "A avançar..." : "Avançar ronda"}
        </button>
      </div>
    </div>
  );
}
