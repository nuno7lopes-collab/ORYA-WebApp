export function AutoSchedulePanel(props: {
  busy: boolean;
  onGenerate?: () => void;
  onSimulate: () => void;
  onApply: () => void;
  onReplan?: () => void;
  onUndo?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">Ações rápidas</p>
      <div className="mt-2 grid gap-2">
        {props.onGenerate ? (
          <button
            type="button"
            onClick={props.onGenerate}
            disabled={props.busy}
            className="rounded-full border border-white/20 px-3 py-2 text-sm text-white hover:border-white/35 disabled:opacity-50"
          >
            Gerar jogos
          </button>
        ) : null}
        <button
          type="button"
          onClick={props.onSimulate}
          disabled={props.busy}
          className="rounded-full border border-white/20 px-3 py-2 text-sm text-white hover:border-white/35 disabled:opacity-50"
        >
          Simular agendamento
        </button>
        <button
          type="button"
          onClick={props.onApply}
          disabled={props.busy}
          className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          Aplicar agendamento
        </button>
        {props.onReplan ? (
          <button
            type="button"
            onClick={props.onReplan}
            disabled={props.busy}
            className="rounded-full border border-white/20 px-3 py-2 text-sm text-white hover:border-white/35 disabled:opacity-50"
          >
            Reagendar pendentes
          </button>
        ) : null}
        {props.onUndo ? (
          <button
            type="button"
            onClick={props.onUndo}
            disabled={props.busy}
            className="rounded-full border border-white/20 px-3 py-2 text-sm text-white hover:border-white/35 disabled:opacity-50"
          >
            Desfazer último lote
          </button>
        ) : null}
      </div>
    </div>
  );
}
