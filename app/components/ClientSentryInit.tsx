"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

let initialized = false;

export function ClientSentryInit() {
  useEffect(() => {
    if (initialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    });
    (globalThis as any).Sentry = Sentry;
    initialized = true;
  }, []);

  return null;
}
