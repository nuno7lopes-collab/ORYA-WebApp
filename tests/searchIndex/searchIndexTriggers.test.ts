import { describe, expect, it } from "vitest";
import { shouldEmitSearchIndexUpdate } from "@/domain/searchIndex/triggers";

describe("searchIndex triggers", () => {
  it("emite quando há ticketType updates", () => {
    const res = shouldEmitSearchIndexUpdate({
      agendaRelevantUpdate: false,
      hasNewTickets: false,
      hasTicketStatusUpdates: true,
    });
    expect(res).toBe(true);
  });
});
