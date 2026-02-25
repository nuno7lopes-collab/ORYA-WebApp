import { useMemo, useState } from "react";
import { OryaDateTimeField } from "@/components/ui/datetime";

type CalendarMatchItem = {
  id: number;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  plannedEndAt?: string | Date | null;
  plannedDurationMinutes?: number | null;
  courtId?: number | null;
  courtName?: string | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
  status?: string | null;
};

type CalendarCourtItem = {
  id: number;
  name: string;
};

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveEnd = (match: CalendarMatchItem) => {
  const direct = toDate(match.plannedEndAt);
  if (direct) return direct;
  const start = toDate(match.plannedStartAt ?? match.startTime);
  if (!start) return null;
  const duration = Number(match.plannedDurationMinutes ?? 60);
  const minutes = Number.isFinite(duration) && duration > 0 ? duration : 60;
  return new Date(start.getTime() + minutes * 60_000);
};

const formatStatus = (status?: string | null) => {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em curso";
    case "RESULT_SUBMITTED":
      return "Resultado submetido";
    case "PENDING_CONFIRMATION":
      return "Pendente confirmação";
    case "DISPUTED":
      return "Disputa";
    case "FINISHED":
      return "Terminado";
    default:
      return "Sem estado";
  }
};

export function CalendarMatchAdjustmentsPanel(props: {
  eventId: number | null;
  timezone: string;
  saving: boolean;
  formatZoned: (value: string | Date, timezone: string) => string;
  matches: CalendarMatchItem[];
  courts: CalendarCourtItem[];
  editingMatchId: number | null;
  selectedMatchIds: number[];
  form: {
    start: string;
    end: string;
    courtId: string;
  };
  onFormChange: (patch: Partial<{ start: string; end: string; courtId: string }>) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditMatch: (matchId: number) => void;
  onToggleSelectMatch: (matchId: number) => void;
  onClearSelection: () => void;
  onBulkMove: (targetCourtId: number) => void;
}) {
  const [bulkCourtId, setBulkCourtId] = useState("");
  const selectedSet = useMemo(() => new Set(props.selectedMatchIds), [props.selectedMatchIds]);

  const sortedMatches = [...props.matches]
    .sort((a, b) => {
      const aStart = toDate(a.plannedStartAt ?? a.startTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = toDate(b.plannedStartAt ?? b.startTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;
      return a.id - b.id;
    });

  const editingActive = props.editingMatchId !== null;
  const disabled = !props.eventId || props.saving || !editingActive;
  const bulkTargetId = Number(bulkCourtId);
  const bulkDisabled = !props.eventId || props.saving || props.selectedMatchIds.length === 0 || !Number.isFinite(bulkTargetId) || bulkTargetId <= 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0d1f3a]/55 to-[#050912]/85 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Ajuste manual de jogos</p>
        <p className="text-[12px] text-white/65">Edita horário/campo e faz ações em lote por seleção.</p>
      </div>

      {sortedMatches.length === 0 ? (
        <p className="text-[12px] text-white/60">Sem jogos visíveis para ajustar neste filtro.</p>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-white/12 bg-black/20 p-3">
            <p className="text-[12px] text-white/70">
              {editingActive
                ? `A editar jogo #${props.editingMatchId}`
                : "Seleciona um jogo abaixo para editar horário/campo."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <OryaDateTimeField
                value={props.form.start}
                onChange={(next) => props.onFormChange({ start: next })}
                className="w-full"
                dateButtonClassName="h-10 flex-1 rounded-xl"
                timeButtonClassName="h-10 rounded-xl"
                disabled={disabled}
              />
              <OryaDateTimeField
                value={props.form.end}
                onChange={(next) => props.onFormChange({ end: next })}
                minDateTime={props.form.start || undefined}
                className="w-full"
                dateButtonClassName="h-10 flex-1 rounded-xl"
                timeButtonClassName="h-10 rounded-xl"
                disabled={disabled}
              />
            </div>
            <select
              value={props.form.courtId}
              onChange={(event) => props.onFormChange({ courtId: event.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
            >
              <option value="">Selecionar campo</option>
              {props.courts.map((court) => (
                <option key={`manual-match-court-${court.id}`} value={String(court.id)}>
                  {court.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={props.onSave}
                disabled={disabled}
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {props.saving ? "A guardar..." : "Guardar jogo"}
              </button>
              <button
                type="button"
                onClick={props.onCancel}
                disabled={!editingActive || props.saving}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-50"
              >
                Cancelar edição
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/12 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Seleção em lote</p>
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                {props.selectedMatchIds.length} selecionado{props.selectedMatchIds.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                value={bulkCourtId}
                onChange={(event) => setBulkCourtId(event.target.value)}
                disabled={!props.eventId || props.saving}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
              >
                <option value="">Mover selecionados para campo...</option>
                {props.courts.map((court) => (
                  <option key={`bulk-match-court-${court.id}`} value={String(court.id)}>
                    {court.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => props.onBulkMove(bulkTargetId)}
                disabled={bulkDisabled}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Aplicar lote
              </button>
              <button
                type="button"
                onClick={props.onClearSelection}
                disabled={props.selectedMatchIds.length === 0 || props.saving}
                className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-50"
              >
                Limpar seleção
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/12 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Jogos visíveis</p>
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                {props.matches.length}
              </span>
            </div>
            <div className="space-y-2">
              {sortedMatches.map((match) => {
                const start = toDate(match.plannedStartAt ?? match.startTime);
                const end = resolveEnd(match);
                const isSelected = selectedSet.has(match.id);
                return (
                  <div
                    key={`manual-match-${match.id}`}
                    className={`rounded-lg border px-2 py-2 text-[12px] ${isSelected ? "border-[#22D3EE]/60 bg-[#22D3EE]/12" : "border-white/12 bg-white/[0.03]"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => props.onToggleSelectMatch(match.id)}
                          className="h-3.5 w-3.5 rounded border-white/30 bg-transparent accent-[#22D3EE]"
                        />
                        <p className="font-semibold text-white">Jogo #{match.id}</p>
                      </div>
                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/70">
                        {formatStatus(match.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-white/70">
                      {start ? props.formatZoned(start, props.timezone) : "Sem início"}
                      {end ? ` -> ${props.formatZoned(end, props.timezone)}` : ""}
                      {match.courtName ? ` · ${match.courtName}` : ""}
                    </p>
                    {(match.roundLabel || match.groupLabel) ? (
                      <p className="mt-1 text-white/60">
                        {match.roundLabel || "Ronda"}
                        {match.groupLabel ? ` · Grupo ${match.groupLabel}` : ""}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => props.onEditMatch(match.id)}
                        disabled={props.saving}
                        className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white hover:border-white/35 disabled:opacity-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!props.eventId ? <p className="text-[12px] text-white/55">Precisas de eventId no URL.</p> : null}
    </div>
  );
}
