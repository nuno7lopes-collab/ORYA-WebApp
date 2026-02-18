export const DEFAULT_CALENDAR_TIMEZONE = "Europe/Lisbon";

export type CalendarTimezoneOption = {
  value: string;
  label: string;
};

export const CALENDAR_TIMEZONE_OPTIONS: CalendarTimezoneOption[] = [
  { value: "Europe/Lisbon", label: "Europe/Lisbon (Default)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
];

export function isValidIanaTimezone(value: string) {
  try {
    // `Intl.DateTimeFormat` throws on invalid IANA names.
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeCalendarTimezone(raw: string | null | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return DEFAULT_CALENDAR_TIMEZONE;
  return isValidIanaTimezone(value) ? value : DEFAULT_CALENDAR_TIMEZONE;
}
