export function shouldEmitSearchIndexUpdate(params: {
  agendaRelevantUpdate: boolean;
  hasNewTickets: boolean;
  hasTicketStatusUpdates: boolean;
}) {
  return params.agendaRelevantUpdate || params.hasNewTickets || params.hasTicketStatusUpdates;
}
