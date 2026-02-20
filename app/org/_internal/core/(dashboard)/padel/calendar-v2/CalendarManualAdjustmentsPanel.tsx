import { OryaDateTimeField } from "@/components/ui/datetime";

type CalendarBlockItem = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  label?: string | null;
  note?: string | null;
  courtName?: string | null;
};

type CalendarAvailabilityItem = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  playerName?: string | null;
  playerEmail?: string | null;
  note?: string | null;
};

export function CalendarManualAdjustmentsPanel(props: {
  eventId: number | null;
  timezone: string;
  saving: boolean;
  formatZoned: (value: string | Date, timezone: string) => string;
  blockForm: {
    start: string;
    end: string;
    label: string;
    note: string;
  };
  onBlockFormChange: (patch: Partial<{ start: string; end: string; label: string; note: string }>) => void;
  onSaveBlock: () => void;
  editingBlockId: number | null;
  onCancelBlockEdit: () => void;
  canUndoBlock: boolean;
  onUndoBlock: () => void;
  blocks: CalendarBlockItem[];
  onEditBlock: (id: number) => void;
  onDeleteBlock: (id: number) => void;
  availabilityForm: {
    start: string;
    end: string;
    playerName: string;
    playerEmail: string;
    note: string;
  };
  onAvailabilityFormChange: (patch: Partial<{ start: string; end: string; playerName: string; playerEmail: string; note: string }>) => void;
  onSaveAvailability: () => void;
  editingAvailabilityId: number | null;
  onCancelAvailabilityEdit: () => void;
  canUndoAvailability: boolean;
  onUndoAvailability: () => void;
  availabilities: CalendarAvailabilityItem[];
  onEditAvailability: (id: number) => void;
  onDeleteAvailability: (id: number) => void;
}) {
  const sortedBlocks = [...props.blocks]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 10);
  const sortedAvailabilities = [...props.availabilities]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Correções manuais</p>
        <p className="text-[12px] text-white/65">
          Ajusta bloqueios e indisponibilidades sem sair da agenda.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/8 via-[#10213f]/55 to-[#060d1c]/90 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Bloqueios</p>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70">
              {props.blocks.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <OryaDateTimeField
              value={props.blockForm.start}
              onChange={(next) => props.onBlockFormChange({ start: next })}
              className="w-full"
              dateButtonClassName="h-10 flex-1 rounded-lg"
              timeButtonClassName="h-10 rounded-lg"
              disabled={!props.eventId || props.saving}
            />
            <OryaDateTimeField
              value={props.blockForm.end}
              onChange={(next) => props.onBlockFormChange({ end: next })}
              minDateTime={props.blockForm.start || undefined}
              className="w-full"
              dateButtonClassName="h-10 flex-1 rounded-lg"
              timeButtonClassName="h-10 rounded-lg"
              disabled={!props.eventId || props.saving}
            />
          </div>
          <input
            type="text"
            value={props.blockForm.label}
            onChange={(event) => props.onBlockFormChange({ label: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Título do bloqueio (opcional)"
            disabled={!props.eventId || props.saving}
          />
          <input
            type="text"
            value={props.blockForm.note}
            onChange={(event) => props.onBlockFormChange({ note: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Nota (opcional)"
            disabled={!props.eventId || props.saving}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={props.onSaveBlock}
              disabled={!props.eventId || props.saving}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {props.saving ? "A guardar…" : props.editingBlockId ? "Atualizar bloqueio" : "Guardar bloqueio"}
            </button>
            {props.canUndoBlock ? (
              <button
                type="button"
                onClick={props.onUndoBlock}
                disabled={props.saving}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
              >
                Desfazer último
              </button>
            ) : null}
            {props.editingBlockId ? (
              <button
                type="button"
                onClick={props.onCancelBlockEdit}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2">
            {sortedBlocks.length === 0 ? (
              <p className="text-[12px] text-white/60">Sem bloqueios visíveis neste filtro.</p>
            ) : (
              sortedBlocks.map((item) => (
                <div
                  key={`manual-block-${item.id}`}
                  className="rounded-lg border border-white/12 bg-white/[0.03] px-2 py-2 text-[12px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">{item.label || `Bloqueio #${item.id}`}</p>
                    <span className="text-white/60">#{item.id}</span>
                  </div>
                  <p className="mt-1 text-white/70">
                    {props.formatZoned(item.startAt, props.timezone)} → {props.formatZoned(item.endAt, props.timezone)}
                    {item.courtName ? ` · ${item.courtName}` : ""}
                  </p>
                  {item.note ? <p className="mt-1 text-white/55">{item.note}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => props.onEditBlock(item.id)}
                      className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white hover:border-white/35"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDeleteBlock(item.id)}
                      className="rounded-full border border-red-400/60 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-50 hover:border-red-300/80"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/8 via-[#26112b]/50 to-[#060d1c]/90 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Indisponibilidades</p>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70">
              {props.availabilities.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <OryaDateTimeField
              value={props.availabilityForm.start}
              onChange={(next) => props.onAvailabilityFormChange({ start: next })}
              className="w-full"
              dateButtonClassName="h-10 flex-1 rounded-lg"
              timeButtonClassName="h-10 rounded-lg"
              disabled={!props.eventId || props.saving}
            />
            <OryaDateTimeField
              value={props.availabilityForm.end}
              onChange={(next) => props.onAvailabilityFormChange({ end: next })}
              minDateTime={props.availabilityForm.start || undefined}
              className="w-full"
              dateButtonClassName="h-10 flex-1 rounded-lg"
              timeButtonClassName="h-10 rounded-lg"
              disabled={!props.eventId || props.saving}
            />
          </div>
          <input
            type="text"
            value={props.availabilityForm.playerName}
            onChange={(event) => props.onAvailabilityFormChange({ playerName: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Nome do jogador (opcional)"
            disabled={!props.eventId || props.saving}
          />
          <input
            type="email"
            value={props.availabilityForm.playerEmail}
            onChange={(event) => props.onAvailabilityFormChange({ playerEmail: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Email (opcional)"
            disabled={!props.eventId || props.saving}
          />
          <input
            type="text"
            value={props.availabilityForm.note}
            onChange={(event) => props.onAvailabilityFormChange({ note: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Nota (opcional)"
            disabled={!props.eventId || props.saving}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={props.onSaveAvailability}
              disabled={!props.eventId || props.saving}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {props.saving
                ? "A guardar…"
                : props.editingAvailabilityId
                  ? "Atualizar indisponibilidade"
                  : "Guardar indisponibilidade"}
            </button>
            {props.canUndoAvailability ? (
              <button
                type="button"
                onClick={props.onUndoAvailability}
                disabled={props.saving}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-60"
              >
                Desfazer último
              </button>
            ) : null}
            {props.editingAvailabilityId ? (
              <button
                type="button"
                onClick={props.onCancelAvailabilityEdit}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2">
            {sortedAvailabilities.length === 0 ? (
              <p className="text-[12px] text-white/60">Sem indisponibilidades visíveis neste filtro.</p>
            ) : (
              sortedAvailabilities.map((item) => (
                <div
                  key={`manual-availability-${item.id}`}
                  className="rounded-lg border border-white/12 bg-white/[0.03] px-2 py-2 text-[12px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {item.playerName || item.playerEmail || `Indisponibilidade #${item.id}`}
                    </p>
                    <span className="text-white/60">#{item.id}</span>
                  </div>
                  <p className="mt-1 text-white/70">
                    {props.formatZoned(item.startAt, props.timezone)} → {props.formatZoned(item.endAt, props.timezone)}
                  </p>
                  {item.note ? <p className="mt-1 text-white/55">{item.note}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => props.onEditAvailability(item.id)}
                      className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white hover:border-white/35"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDeleteAvailability(item.id)}
                      className="rounded-full border border-red-400/60 bg-red-500/15 px-2.5 py-1 text-[11px] text-red-50 hover:border-red-300/80"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {!props.eventId ? <p className="text-[12px] text-white/55">Precisas de eventId no URL.</p> : null}
    </div>
  );
}
