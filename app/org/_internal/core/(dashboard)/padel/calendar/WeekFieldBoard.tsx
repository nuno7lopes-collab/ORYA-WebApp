import { DayFieldGrid } from "./DayFieldGrid";

type WeekBoardCourt = { id: number; name: string };
type WeekBoardMatch = {
  id: number;
  courtId?: number | null;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  plannedEndAt?: string | Date | null;
  plannedDurationMinutes?: number | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
};

type WeekBoardBlock = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  label?: string | null;
  note?: string | null;
  courtId?: number | null;
  courtName?: string | null;
};

type WeekBoardAvailability = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  playerName?: string | null;
  playerEmail?: string | null;
  note?: string | null;
};

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function WeekFieldBoard(props: {
  weekStart: Date;
  courts: WeekBoardCourt[];
  matches: WeekBoardMatch[];
  blocks?: WeekBoardBlock[];
  availabilities?: WeekBoardAvailability[];
  timezone: string;
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
}) {
  const days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(props.weekStart);
    date.setDate(date.getDate() + idx);
    return startOfDay(date);
  });

  const blocks = props.blocks ?? [];
  const availabilities = props.availabilities ?? [];

  return (
    <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => {
        const key = dayKey(day, props.timezone);
        const dayMatches = props.matches.filter((match) => {
          const start = toDate(match.startTime ?? match.plannedStartAt);
          if (!start) return false;
          return dayKey(start, props.timezone) === key;
        });
        const dayBlocks = blocks.filter((block) => {
          const start = toDate(block.startAt);
          if (!start) return false;
          return dayKey(start, props.timezone) === key;
        });
        const dayAvailabilities = availabilities.filter((item) => {
          const start = toDate(item.startAt);
          if (!start) return false;
          return dayKey(start, props.timezone) === key;
        });
        const dayLabel = new Intl.DateTimeFormat("pt-PT", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          timeZone: props.timezone,
        }).format(day);
        return (
          <div key={`week-day-${key}`} className="rounded-xl border border-white/12 bg-black/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">{dayLabel}</p>
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                {dayMatches.length} jogo{dayMatches.length === 1 ? "" : "s"}
                {dayBlocks.length > 0 ? ` · ${dayBlocks.length} bloqueio${dayBlocks.length === 1 ? "" : "s"}` : ""}
              </span>
            </div>
            <div className="mt-2">
              <DayFieldGrid
                courts={props.courts}
                matches={dayMatches}
                blocks={dayBlocks}
                availabilities={dayAvailabilities}
                timezone={props.timezone}
                onEditMatch={props.onEditMatch}
                onQuickMoveMatch={props.onQuickMoveMatch}
                onQuickRescheduleMatch={props.onQuickRescheduleMatch}
                selectedMatchIds={props.selectedMatchIds}
                onToggleSelectMatch={props.onToggleSelectMatch}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
