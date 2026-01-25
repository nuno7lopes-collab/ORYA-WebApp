export type IcsEventInput = {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

function escapeIcsText(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtc(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildIcsEvent(input: IcsEventInput) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//ORYA//Calendar//PT",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(input.startsAt)}`,
    `DTEND:${formatUtc(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];

  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.url) lines.push(`URL:${escapeIcsText(input.url)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\n");
}
