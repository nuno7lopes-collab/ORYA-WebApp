import { OryaDateField } from "@/components/ui/datetime";

type CalendarControlsEvent = {
  id: number;
  title?: string | null;
  startsAt?: string | Date | null;
  padelClubName?: string | null;
};

type CalendarControlsCategoryOption = {
  key: string;
  label: string;
};

export function CalendarControls(props: {
  eventId: number | null;
  onEventChange: (eventId: number | null) => void;
  padelEventsLoading: boolean;
  padelEvents: CalendarControlsEvent[];
  categoryKey: string;
  categoryOptions: CalendarControlsCategoryOption[];
  onCategoryChange: (next: string) => void;
  formatShortDate: (value: string | Date | null | undefined) => string;
  calendarTimezone: string;
  calendarBuffer: number;
  calendarScope: "week" | "day";
  onCalendarScopeChange: (scope: "week" | "day") => void;
  switchingTab: boolean;
  selectedDay: string;
  onSelectedDayChange: (next: string) => void;
  calendarFilter: "all" | "club";
  onCalendarFilterChange: (next: "all" | "club") => void;
  slotMinutes: number;
  onSlotMinutesChange: (next: number) => void;
  calendarDataView: "complete" | "games";
  onCalendarDataViewChange: (next: "complete" | "games") => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 uppercase tracking-[0.16em]">
          Calendário
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
          Fuso {props.calendarTimezone}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
          Buffer {props.calendarBuffer} min
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_auto]">
        <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80 sm:col-span-2 xl:col-span-1">
          <span className="shrink-0 text-white/55">Torneio</span>
          <select
            value={props.eventId ? String(props.eventId) : ""}
            onChange={(event) =>
              props.onEventChange(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="min-w-0 flex-1 bg-transparent text-white/90 outline-none"
            disabled={props.padelEventsLoading}
          >
            <option value="">
              {props.padelEventsLoading
                ? "A carregar torneios..."
                : props.padelEvents.length > 0
                  ? "Seleciona um torneio"
                  : "Sem torneios de padel"}
            </option>
            {props.padelEvents.map((event) => (
              <option key={`padel-event-${event.id}`} value={event.id}>
                {(event.title || `Torneio ${event.id}`).trim()}
                {event.startsAt
                  ? ` · ${props.formatShortDate(event.startsAt)}`
                  : ""}
                {event.padelClubName ? ` · ${event.padelClubName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80">
          <span className="shrink-0 text-white/55">Categoria</span>
          <select
            value={props.categoryKey}
            onChange={(event) => props.onCategoryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-white/90 outline-none"
            disabled={props.switchingTab}
          >
            {props.categoryOptions.map((option) => (
              <option key={`calendar-category-${option.key}`} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
          {(["week", "day"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => props.onCalendarScopeChange(scope)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                props.calendarScope === scope
                  ? "bg-white text-black shadow"
                  : "text-white/75"
              }`}
              disabled={props.switchingTab}
            >
              {scope === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>

        <OryaDateField
          value={props.selectedDay}
          onChange={props.onSelectedDayChange}
          className="min-w-[150px]"
          buttonClassName="h-8 rounded-xl text-[12px]"
        />

        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px] sm:col-span-2 lg:col-span-3 xl:col-span-1">
          {[
            { key: "all", label: "Todos os clubes" },
            { key: "club", label: "Clube selecionado" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => props.onCalendarFilterChange(opt.key as "all" | "club")}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                props.calendarFilter === opt.key
                  ? "bg-white text-black shadow"
                  : "text-white/75"
              }`}
              disabled={props.switchingTab}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
          {[15, 30].map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => props.onSlotMinutesChange(slot)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                props.slotMinutes === slot
                  ? "bg-white text-black shadow"
                  : "text-white/75"
              }`}
              disabled={props.switchingTab}
            >
              Slot {slot}m
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
          {[
            { key: "complete", label: "Completo" },
            { key: "games", label: "Jogos do torneio" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() =>
                props.onCalendarDataViewChange(opt.key as "complete" | "games")
              }
              className={`rounded-full px-3 py-1 font-semibold transition ${
                props.calendarDataView === opt.key
                  ? "bg-white text-black shadow"
                  : "text-white/75"
              }`}
              disabled={props.switchingTab}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
