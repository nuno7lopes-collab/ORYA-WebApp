export type AnalyticsPayload = Record<string, unknown>;

export function trackEvent(name: string, payload?: AnalyticsPayload) {
  // Placeholder for future providers (PostHog/Amplitude/GA).
  // Keep console logging for now to avoid blocking UX.
  if (__DEV__) {
    console.log("[trackEvent]", name, payload ?? {});
    return;
  }
  console.log("[trackEvent]", name, payload ?? {});
}
