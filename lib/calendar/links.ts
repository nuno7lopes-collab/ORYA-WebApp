export type CalendarLinkInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  timeZone?: string | null;
};

function formatGoogleDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarLink(input: CalendarLinkInput) {
  const googleUrl = new URL("https://calendar.google.com/calendar/render");
  googleUrl.searchParams.set("action", "TEMPLATE");
  googleUrl.searchParams.set("text", input.title);
  googleUrl.searchParams.set("dates", `${formatGoogleDate(input.startsAt)}/${formatGoogleDate(input.endsAt)}`);
  if (input.description) googleUrl.searchParams.set("details", input.description);
  if (input.location) googleUrl.searchParams.set("location", input.location);
  if (input.url) googleUrl.searchParams.set("sprop", `website:${input.url}`);
  if (input.timeZone) googleUrl.searchParams.set("ctz", input.timeZone);
  return googleUrl.toString();
}

export function buildOutlookCalendarLink(input: CalendarLinkInput) {
  const outlookUrl = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlookUrl.searchParams.set("path", "/calendar/action/compose");
  outlookUrl.searchParams.set("rru", "addevent");
  outlookUrl.searchParams.set("subject", input.title);
  outlookUrl.searchParams.set("startdt", input.startsAt.toISOString());
  outlookUrl.searchParams.set("enddt", input.endsAt.toISOString());
  if (input.description) outlookUrl.searchParams.set("body", input.description);
  if (input.location) outlookUrl.searchParams.set("location", input.location);
  if (input.url) outlookUrl.searchParams.set("sprop", `website:${input.url}`);
  return outlookUrl.toString();
}
