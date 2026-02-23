export type AnalyticsPayload = Record<string, unknown>;

export function trackEvent(name: string, payload?: AnalyticsPayload) {
  // Placeholder for future providers (PostHog/Amplitude/GA).
  // Keep console logging only in development to avoid noisy production output.
  if (__DEV__) {
    console.log("[trackEvent]", name, payload ?? {});
  }
}
