type RoundOpsOption = {
  key: string;
  label: string;
};

export function RoundOpsPanel(props: {
  categoryKey: string;
  categoryOptions: RoundOpsOption[];
  onCategoryChange: (next: string) => void;
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
      <p className="mt-1 text-xs text-white/70">Avanço incremental com validação de runtime.</p>

      <div className="mt-2 grid gap-2">
        <select
          value={props.categoryKey}
          onChange={(event) => props.onCategoryChange(event.target.value)}
          className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
          disabled={disabled}
        >
          {props.categoryOptions.map((option) => (
            <option key={`v2-round-ops-${option.key}`} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/75">
          <p>
            Formato: <span className="font-semibold text-white">{props.formatLabel}</span>
          </p>
          <p className="mt-1">
            Ronda atual: <span className="font-semibold text-white">{props.roundLabel}</span>
          </p>
          {props.note ? <p className="mt-1 text-white/65">{props.note}</p> : null}
        </div>
      </div>

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
          {props.busy ? "A processar..." : "Simular avanço"}
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
