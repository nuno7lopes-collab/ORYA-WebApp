export type ProjectedAgendaItem<TItem> = {
  item: TItem;
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

export type AggregateAgendaItem<TItem> = {
  dayKey: string;
  start: Date;
  end: Date;
  top: number;
  height: number;
  items: ProjectedAgendaItem<TItem>[];
  startMinute: number;
  endMinute: number;
};

export function buildAggregateAgendaItems<TItem>(params: {
  positions: ProjectedAgendaItem<TItem>[];
  dayKey: string;
  minuteHeight: number;
  minimumHeight?: number;
}) {
  const minimumHeight = params.minimumHeight ?? 28;
  const groups: AggregateAgendaItem<TItem>[] = [];

  params.positions.forEach((position) => {
    const current = groups[groups.length - 1];
    if (!current || position.startMinute >= current.endMinute) {
      groups.push({
        dayKey: params.dayKey,
        start: position.start,
        end: position.end,
        top: position.startMinute * params.minuteHeight,
        height: Math.max((position.endMinute - position.startMinute) * params.minuteHeight, minimumHeight),
        items: [position],
        startMinute: position.startMinute,
        endMinute: position.endMinute,
      });
      return;
    }

    current.end = new Date(Math.max(current.end.getTime(), position.end.getTime()));
    current.startMinute = Math.min(current.startMinute, position.startMinute);
    current.endMinute = Math.max(current.endMinute, position.endMinute);
    current.top = current.startMinute * params.minuteHeight;
    current.height = Math.max((current.endMinute - current.startMinute) * params.minuteHeight, minimumHeight);
    current.items.push(position);
  });

  return groups;
}

export function getAggregateKey(dayKey: string, startMinute: number, endMinute: number) {
  return `${dayKey}:${startMinute}-${endMinute}`;
}
