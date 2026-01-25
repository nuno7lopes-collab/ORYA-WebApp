import { describe, expect, it } from "vitest";
import { buildGoogleCalendarLink, buildOutlookCalendarLink } from "@/lib/calendar/links";

describe("calendar links", () => {
  it("gera link Google com datas e texto", () => {
    const url = buildGoogleCalendarLink({
      title: "Open ORYA",
      startsAt: new Date("2025-01-01T10:00:00Z"),
      endsAt: new Date("2025-01-01T12:00:00Z"),
      location: "Lisboa",
    });
    expect(url).toContain("calendar.google.com");
    expect(url).toContain("text=Open+ORYA");
    expect(url).toContain("dates=20250101T100000Z%2F20250101T120000Z");
  });

  it("gera link Outlook com start/end", () => {
    const url = buildOutlookCalendarLink({
      title: "Open ORYA",
      startsAt: new Date("2025-01-01T10:00:00Z"),
      endsAt: new Date("2025-01-01T12:00:00Z"),
      location: "Lisboa",
    });
    expect(url).toContain("outlook.live.com");
    expect(url).toContain("subject=Open+ORYA");
    expect(url).toContain("startdt=2025-01-01T10%3A00%3A00.000Z");
  });
});
