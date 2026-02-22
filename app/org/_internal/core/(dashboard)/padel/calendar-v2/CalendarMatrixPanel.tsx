import Link from "next/link";
import { AutoSchedulePanel } from "./AutoSchedulePanel";
import { AutoScheduleRunStatusPanel } from "./AutoScheduleRunStatusPanel";
import { DayFieldGrid } from "./DayFieldGrid";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { RoundOpsPanel } from "./RoundOpsPanel";
import { ScheduleShell } from "./ScheduleShell";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { UnscheduledQueue } from "./UnscheduledQueue";
import { WeekFieldBoard } from "./WeekFieldBoard";

type CalendarCourt = { id: number; name: string };
type CalendarMatch = {
  id: number;
  courtId?: number | null;
  courtName?: string | null;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  plannedEndAt?: string | Date | null;
  plannedDurationMinutes?: number | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
};

type CalendarBlock = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  label?: string | null;
  note?: string | null;
  courtId?: number | null;
  courtName?: string | null;
};

type CalendarAvailability = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  playerName?: string | null;
  playerEmail?: string | null;
  note?: string | null;
};

type CategorySummary = {
  categoryId: number | null;
  categoryLabel?: string | null;
  scheduledCount: number;
  skippedCount: number;
};

type RoundOpsCategoryOption = {
  key: string;
  label: string;
};

export function CalendarMatrixPanel(props: {
  eventId: number | null;
  isCalendarLoading: boolean;
  padelEventsLoading: boolean;
  padelEventsCount: number;
  tournamentsCreateHref: string;
  padelEventsError: string | null;
  hasSelectedEvent: boolean;
  calendarError: string | null;
  calendarWarning: string | null;
  calendarMessage: string | null;
  calendarScope: "week" | "day";
  selectedDay: string;
  selectedDayLabel: string | null;
  onCalendarScopeChange: (scope: "week" | "day") => void;
  weekStart: Date | null;
  calendarCourts: CalendarCourt[];
  calendarMatches: CalendarMatch[];
  calendarBlocks: CalendarBlock[];
  calendarAvailabilities: CalendarAvailability[];
  calendarTimezone: string;
  warnings: string[];
  conflictsCount: number;
  byCategory: CategorySummary[];
  unscheduledRows: Array<{ label: string; value: number }>;
  autoScheduling: boolean;
  onGenerate?: () => void;
  onSimulate: () => void;
  onApply: () => void;
  onUndoLastRun?: () => void;
  onEditMatch?: (matchId: number) => void;
  onQuickMoveMatch?: (matchId: number, targetCourtId: number) => void;
  onQuickRescheduleMatch?: (payload: {
    matchId: number;
    targetCourtId: number;
    targetStartIso: string;
    targetEndIso: string;
    durationMinutes: number;
  }) => void;
  selectedMatchIds?: number[];
  onToggleSelectMatch?: (matchId: number) => void;
  latestRun?:
    | {
        id: string;
        status: string;
        scheduledCount: number;
        skippedCount: number;
        applied?: boolean;
        queued?: boolean;
        errorCode?: string | null;
        byCategory?: Array<{
          categoryId: number | null;
          categoryLabel?: string | null;
          scheduledCount: number;
          skippedCount: number;
        }>;
      }
    | null;
  roundOps: {
    categoryKey: string;
    categoryOptions: RoundOpsCategoryOption[];
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
  };
}) {
  return (
    <div className="min-h-[420px] rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 text-white/70">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Matriz por dia e campo</p>
        {props.isCalendarLoading ? <span className="text-[11px] text-white/60 animate-pulse">A carregar…</span> : null}
      </div>
      {!props.eventId ? (
        <div className="mt-2 space-y-1 text-[12px] text-white/60">
          <p>Seleciona um torneio para carregar o calendário.</p>
          {!props.padelEventsLoading && props.padelEventsCount === 0 ? (
            <p className="text-white/50">
              Ainda não tens torneios de padel. <Link href={props.tournamentsCreateHref} className="text-white underline">Criar torneio</Link>.
            </p>
          ) : null}
          {props.padelEventsError ? <p className="text-red-200">{props.padelEventsError}</p> : null}
        </div>
      ) : null}
      {props.eventId && !props.padelEventsLoading && !props.hasSelectedEvent ? (
        <p className="mt-2 text-[12px] text-amber-200">Torneio indisponível para esta organização.</p>
      ) : null}
      {props.eventId && !props.isCalendarLoading && props.calendarError ? (
        <p className="mt-2 text-[12px] text-red-200">{props.calendarError}</p>
      ) : null}
      {props.eventId && !props.isCalendarLoading && props.calendarWarning ? (
        <p className="mt-2 text-[12px] text-amber-200">{props.calendarWarning}</p>
      ) : null}
      {props.eventId && !props.isCalendarLoading && props.calendarMessage ? (
        <p className="mt-2 text-[12px] text-emerald-200">{props.calendarMessage}</p>
      ) : null}
      {props.eventId && props.calendarScope === "day" && !props.isCalendarLoading && !props.calendarError && props.selectedDayLabel ? (
        <p className="mt-2 text-[12px] text-white/60">
          A mostrar registos de {props.selectedDay} ({props.selectedDayLabel}).
        </p>
      ) : null}
      {props.eventId && !props.isCalendarLoading && !props.calendarError ? (
        <div className="mt-3">
          <ScheduleShell
            toolbar={
              <ScheduleToolbar
                title="Agendamento por dia e campo"
                subtitle={`Fuso ${props.calendarTimezone} · ${props.calendarScope === "week" ? "Semana" : "Dia"}`}
                actions={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => props.onCalendarScopeChange("day")}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        props.calendarScope === "day" ? "bg-white text-black" : "border border-white/25 text-white/80"
                      }`}
                    >
                      Dia
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onCalendarScopeChange("week")}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        props.calendarScope === "week" ? "bg-white text-black" : "border border-white/25 text-white/80"
                      }`}
                    >
                      Semana
                    </button>
                  </div>
                }
              />
            }
            main={
              props.calendarScope === "week" && props.weekStart ? (
                <WeekFieldBoard
                  weekStart={props.weekStart}
                  courts={props.calendarCourts}
                  matches={props.calendarMatches}
                  blocks={props.calendarBlocks}
                  availabilities={props.calendarAvailabilities}
                  timezone={props.calendarTimezone}
                  onEditMatch={props.onEditMatch}
                  onQuickMoveMatch={props.onQuickMoveMatch}
                  onQuickRescheduleMatch={props.onQuickRescheduleMatch}
                  selectedMatchIds={props.selectedMatchIds}
                  onToggleSelectMatch={props.onToggleSelectMatch}
                />
              ) : (
                <DayFieldGrid
                  courts={props.calendarCourts}
                  matches={props.calendarMatches}
                  blocks={props.calendarBlocks}
                  availabilities={props.calendarAvailabilities}
                  timezone={props.calendarTimezone}
                  onEditMatch={props.onEditMatch}
                  onQuickMoveMatch={props.onQuickMoveMatch}
                  onQuickRescheduleMatch={props.onQuickRescheduleMatch}
                  selectedMatchIds={props.selectedMatchIds}
                  onToggleSelectMatch={props.onToggleSelectMatch}
                />
              )
            }
            side={
              <>
                <DiagnosticsPanel warnings={props.warnings} conflictsCount={props.conflictsCount} byCategory={props.byCategory} />
                <AutoScheduleRunStatusPanel run={props.latestRun ?? null} />
                <UnscheduledQueue rows={props.unscheduledRows} />
                <AutoSchedulePanel
                  busy={props.autoScheduling}
                  onGenerate={props.onGenerate}
                  onSimulate={props.onSimulate}
                  onApply={props.onApply}
                  onReplan={props.onApply}
                  onUndo={props.onUndoLastRun}
                />
                <RoundOpsPanel
                  categoryKey={props.roundOps.categoryKey}
                  categoryOptions={props.roundOps.categoryOptions}
                  onCategoryChange={props.roundOps.onCategoryChange}
                  formatLabel={props.roundOps.formatLabel}
                  roundLabel={props.roundOps.roundLabel}
                  note={props.roundOps.note}
                  hasRuntime={props.roundOps.hasRuntime}
                  busy={props.roundOps.busy}
                  profileBusy={props.roundOps.profileBusy}
                  onSimulate={props.roundOps.onSimulate}
                  onAdvance={props.roundOps.onAdvance}
                  message={props.roundOps.message}
                  warning={props.roundOps.warning}
                  error={props.roundOps.error}
                />
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
