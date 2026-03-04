export const CALENDAR_AVAILABILITY_OVERLAY_STORAGE_KEY = "orya.calendar.availabilityOverlay.v1";

export function parseAvailabilityOverlayPreference(value: string | null | undefined): boolean | null {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

export function serializeAvailabilityOverlayPreference(value: boolean): "1" | "0" {
  return value ? "1" : "0";
}
