export async function ensureEventThreads(eventIds: number[]) {
  void eventIds;
  // Legacy chat threads were removed in favor of chat_conversations + chat_access_grants.
  // Keep this API as a no-op for backwards compatibility with old callers.
}

export async function ensureEventThread(eventId: number) {
  void eventId;
}
