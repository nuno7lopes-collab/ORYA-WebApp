type DedupeInput = string | number | null | undefined;

export function makeOutboxDedupeKey(eventType: string, causationId: DedupeInput, _payload?: unknown) {
  const type = typeof eventType === "string" ? eventType.trim() : "";
  const cause =
    typeof causationId === "number"
      ? String(causationId)
      : typeof causationId === "string"
        ? causationId.trim()
        : "";

  if (!type || !cause) {
    throw new Error("OUTBOX_DEDUPE_KEY_INVALID");
  }
  return `${type}:${cause}`;
}
