type DateRange = {
  from?: Date | null;
  to?: Date | null;
};

export function buildAgendaOverlapFilter({ from, to }: DateRange) {
  return {
    ...(to ? { startsAt: { lte: to } } : {}),
    ...(from ? { endsAt: { gte: from } } : {}),
  };
}
