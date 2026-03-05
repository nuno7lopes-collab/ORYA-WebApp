import { useState } from "react";

type DayGridCourt = { id: number; name: string };
type DayGridMatch = {
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

type DayGridBlock = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  label?: string | null;
  note?: string | null;
  kind?: string | null;
  courtId?: number | null;
  courtName?: string | null;
};

type DayGridAvailability = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  playerName?: string | null;
  playerEmail?: string | null;
  note?: string | null;
};

type DayGridQuickRescheduleInput = {
  matchId: number;
  targetCourtId: number;
  targetStartIso: string;
  targetEndIso: string;
  durationMinutes: number;
};

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (value: string | Date | null | undefined, timezone: string) => {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(d);
};

const resolveMatchEnd = (match: DayGridMatch) => {
  const explicit = toDate(match.plannedEndAt);
  if (explicit) return explicit;
  const start = toDate(match.startTime ?? match.plannedStartAt);
  if (!start) return null;
  const duration = Number(match.plannedDurationMinutes ?? 60);
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 60;
  return new Date(start.getTime() + safeDuration * 60_000);
};

const resolveMatchStart = (match: DayGridMatch) =>
  toDate(match.startTime ?? match.plannedStartAt);

const resolveMatchDurationMinutes = (match: DayGridMatch) => {
  const start = resolveMatchStart(match);
  const end = resolveMatchEnd(match);
  if (start && end) {
    const diff = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (Number.isFinite(diff) && diff > 0) return diff;
  }
  const fallback = Number(match.plannedDurationMinutes ?? 60);
  return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback) : 60;
};

const buildDropSlots = (
  entries: Array<{ start: Date | null; end: Date | null }>,
) => {
  const starts = entries
    .map((entry) => entry.start)
    .filter((value): value is Date => Boolean(value));
  const ends = entries
    .map((entry) => entry.end)
    .filter((value): value is Date => Boolean(value));
  const anchor = starts[0] ?? ends[0] ?? new Date();
  const minHour =
    starts.length > 0 ? Math.min(...starts.map((item) => item.getHours())) : 8;
  const maxHour =
    ends.length > 0 ? Math.max(...ends.map((item) => item.getHours())) : 22;
  const fromHour = Math.max(6, minHour - 1);
  const toHour = Math.min(23, maxHour + 2);
  const slots: Date[] = [];
  for (let hour = fromHour; hour <= toHour; hour += 1) {
    [0, 30].forEach((minute) => {
      const slot = new Date(anchor);
      slot.setHours(hour, minute, 0, 0);
      slots.push(slot);
    });
  }
  return slots;
};

export function DayFieldGrid(props: {
  courts: DayGridCourt[];
  matches: DayGridMatch[];
  blocks?: DayGridBlock[];
  availabilities?: DayGridAvailability[];
  timezone: string;
  onEditMatch?: (matchId: number) => void;
  onQuickMoveMatch?: (matchId: number, targetCourtId: number) => void;
  onQuickRescheduleMatch?: (payload: DayGridQuickRescheduleInput) => void;
  selectedMatchIds?: number[];
  onToggleSelectMatch?: (matchId: number) => void;
}) {
  const [draggedMatchId, setDraggedMatchId] = useState<number | null>(null);
  const canDragMatches = Boolean(
    props.onQuickMoveMatch || props.onQuickRescheduleMatch,
  );

  if (props.courts.length === 0) {
    return (
      <p className="text-[12px] text-white/60">
        Sem campos ativos para mostrar.
      </p>
    );
  }

  const blocks = props.blocks ?? [];
  const availabilities = props.availabilities ?? [];
  const selected = new Set(props.selectedMatchIds ?? []);
  const resolveBlockTone = (kind?: string | null) => {
    const normalized =
      typeof kind === "string" ? kind.trim().toUpperCase() : "";
    if (normalized === "CLASS_SESSION") {
      return {
        wrapper: "border-cyan-300/35 bg-cyan-500/10",
        text: "text-cyan-50",
        meta: "text-cyan-100/90",
      };
    }
    if (normalized === "BOOKING") {
      return {
        wrapper: "border-emerald-300/35 bg-emerald-500/10",
        text: "text-emerald-50",
        meta: "text-emerald-100/90",
      };
    }
    if (normalized === "SOFT_BLOCK") {
      return {
        wrapper: "border-violet-300/35 bg-violet-500/10",
        text: "text-violet-50",
        meta: "text-violet-100/90",
      };
    }
    return {
      wrapper: "border-amber-300/35 bg-amber-500/10",
      text: "text-amber-50",
      meta: "text-amber-100/90",
    };
  };

  const globalBlocks = blocks
    .filter((block) => !block.courtId)
    .sort((a, b) => {
      const aStart = toDate(a.startAt)?.getTime() ?? 0;
      const bStart = toDate(b.startAt)?.getTime() ?? 0;
      return aStart - bStart;
    });

  const sortedAvailabilities = [...availabilities].sort((a, b) => {
    const aStart = toDate(a.startAt)?.getTime() ?? 0;
    const bStart = toDate(b.startAt)?.getTime() ?? 0;
    return aStart - bStart;
  });

  return (
    <div className="space-y-2">
      {globalBlocks.length > 0 ? (
        <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-2 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
            Bloqueios globais
          </p>
          <div className="mt-2 space-y-1">
            {globalBlocks.slice(0, 6).map((block) => (
              <div
                key={`day-global-block-${block.id}`}
                className="rounded-lg border border-amber-200/25 bg-black/20 px-2 py-1 text-[12px]"
              >
                <span className="font-semibold text-amber-50">
                  {block.label || `Bloqueio #${block.id}`}
                </span>
                <span className="ml-2 text-amber-100/80">
                  {fmt(block.startAt, props.timezone)} →{" "}
                  {fmt(block.endAt, props.timezone)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {sortedAvailabilities.length > 0 ? (
        <div className="rounded-xl border border-violet-300/35 bg-violet-500/10 p-2 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-100">
            Indisponibilidades
          </p>
          <div className="mt-2 space-y-1">
            {sortedAvailabilities.slice(0, 8).map((item) => (
              <div
                key={`day-availability-${item.id}`}
                className="rounded-lg border border-violet-200/25 bg-black/20 px-2 py-1 text-[12px]"
              >
                <span className="font-semibold text-violet-50">
                  {item.playerName || item.playerEmail || `Jogador #${item.id}`}
                </span>
                <span className="ml-2 text-violet-100/80">
                  {fmt(item.startAt, props.timezone)} →{" "}
                  {fmt(item.endAt, props.timezone)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {props.courts.map((court) => {
        const courtMatches = props.matches
          .filter((match) => (match.courtId ?? null) === court.id)
          .sort((a, b) => {
            const aStart =
              toDate(a.startTime ?? a.plannedStartAt)?.getTime() ?? 0;
            const bStart =
              toDate(b.startTime ?? b.plannedStartAt)?.getTime() ?? 0;
            return aStart - bStart;
          });
        const courtBlocks = blocks
          .filter((block) => (block.courtId ?? null) === court.id)
          .sort((a, b) => {
            const aStart = toDate(a.startAt)?.getTime() ?? 0;
            const bStart = toDate(b.startAt)?.getTime() ?? 0;
            return aStart - bStart;
          });

        const timeline = [
          ...courtBlocks.map((block) => ({
            kind: "block" as const,
            key: `block-${block.id}`,
            start: toDate(block.startAt),
            end: toDate(block.endAt),
            label: block.label || `Bloqueio #${block.id}`,
            note: block.note || null,
            blockKind: block.kind ?? null,
          })),
          ...courtMatches.map((match) => ({
            kind: "match" as const,
            key: `match-${match.id}`,
            id: match.id,
            start: toDate(match.startTime ?? match.plannedStartAt),
            end: resolveMatchEnd(match),
            roundLabel: match.roundLabel,
            groupLabel: match.groupLabel,
            selected: selected.has(match.id),
          })),
        ].sort((a, b) => {
          const aStart = a.start?.getTime() ?? 0;
          const bStart = b.start?.getTime() ?? 0;
          if (aStart !== bStart) return aStart - bStart;
          if (a.kind !== b.kind) return a.kind === "block" ? -1 : 1;
          return a.key.localeCompare(b.key);
        });

        const dropSlots = buildDropSlots(
          timeline.map((entry) => ({
            start: entry.start ?? null,
            end: entry.end ?? null,
          })),
        );

        const dropEnabled = Boolean(canDragMatches && draggedMatchId !== null);

        return (
          <div
            key={`day-court-${court.id}`}
            className={`rounded-xl border border-white/12 bg-black/25 p-2 text-white ${dropEnabled ? "transition-colors" : ""}`}
            onDragOver={(event) => {
              if (!props.onQuickMoveMatch || draggedMatchId === null) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!props.onQuickMoveMatch || draggedMatchId === null) return;
              event.preventDefault();
              props.onQuickMoveMatch(draggedMatchId, court.id);
              setDraggedMatchId(null);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
                {court.name}
              </p>
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                {courtMatches.length} jogo{courtMatches.length === 1 ? "" : "s"}
                {courtBlocks.length > 0
                  ? ` · ${courtBlocks.length} bloqueio${courtBlocks.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
            {timeline.length === 0 ? (
              <p className="mt-1 text-[12px] text-white/55">
                Sem registos neste campo.
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {timeline.map((entry) =>
                  entry.kind === "block" ? (
                    <div
                      key={`day-entry-${entry.key}`}
                      className={`rounded-lg border px-2 py-1 text-[12px] ${resolveBlockTone(entry.blockKind).wrapper}`}
                    >
                      <span
                        className={`font-semibold ${resolveBlockTone(entry.blockKind).text}`}
                      >
                        {entry.label}
                      </span>
                      <span
                        className={`ml-2 ${resolveBlockTone(entry.blockKind).meta}`}
                      >
                        {fmt(entry.start, props.timezone)} →{" "}
                        {fmt(entry.end, props.timezone)}
                      </span>
                      {entry.note ? (
                        <span
                          className={`ml-2 ${resolveBlockTone(entry.blockKind).meta}`}
                        >
                          {entry.note}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      key={`day-entry-${entry.key}`}
                      draggable={canDragMatches}
                      onDragStart={(event) => {
                        if (!canDragMatches) return;
                        setDraggedMatchId(entry.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/plain",
                          String(entry.id),
                        );
                      }}
                      onDragEnd={() => setDraggedMatchId(null)}
                      className={`rounded-lg border px-2 py-1 text-[12px] ${
                        entry.selected
                          ? "border-[#22D3EE]/60 bg-[#22D3EE]/12"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {props.onToggleSelectMatch ? (
                            <input
                              type="checkbox"
                              checked={entry.selected}
                              onChange={() =>
                                props.onToggleSelectMatch?.(entry.id)
                              }
                              className="h-3.5 w-3.5 rounded border-white/30 bg-transparent accent-[#22D3EE]"
                            />
                          ) : null}
                          <div>
                            <span className="font-semibold text-white">
                              #{entry.id}
                            </span>
                            <span className="ml-2 text-white/70">
                              {fmt(entry.start, props.timezone)} →{" "}
                              {fmt(entry.end, props.timezone)}
                            </span>
                            {entry.roundLabel || entry.groupLabel ? (
                              <span className="ml-2 text-white/60">
                                {entry.roundLabel ?? ""}
                                {entry.groupLabel
                                  ? ` · ${entry.groupLabel}`
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canDragMatches ? (
                            <span className="text-[10px] text-white/50">
                              Arrasta
                            </span>
                          ) : null}
                          {props.onEditMatch ? (
                            <button
                              type="button"
                              onClick={() => props.onEditMatch?.(entry.id)}
                              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white hover:border-white/35"
                            >
                              Editar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
            {draggedMatchId !== null && props.onQuickRescheduleMatch ? (
              <div className="mt-2 rounded-lg border border-white/12 bg-white/[0.03] p-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
                  Largar para mudar hora
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-4">
                  {dropSlots.map((slot) => (
                    <button
                      key={`drop-slot-${court.id}-${slot.toISOString()}`}
                      type="button"
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const dragged = props.matches.find(
                          (item) => item.id === draggedMatchId,
                        );
                        if (!dragged) {
                          setDraggedMatchId(null);
                          return;
                        }
                        const durationMinutes =
                          resolveMatchDurationMinutes(dragged);
                        const targetStart = new Date(slot);
                        const targetEnd = new Date(
                          targetStart.getTime() + durationMinutes * 60_000,
                        );
                        props.onQuickRescheduleMatch?.({
                          matchId: dragged.id,
                          targetCourtId: court.id,
                          targetStartIso: targetStart.toISOString(),
                          targetEndIso: targetEnd.toISOString(),
                          durationMinutes,
                        });
                        setDraggedMatchId(null);
                      }}
                      className="rounded-md border border-white/15 bg-black/20 px-1.5 py-1 text-[10px] text-white/75 hover:border-[#22D3EE]/45 hover:text-white"
                    >
                      {fmt(slot, props.timezone)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
