import { env } from "@/lib/env";
import { headers as nextHeaders } from "next/headers";

const DEFAULT_BASE_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  const isProd = process.env.NODE_ENV === "production";
  let raw = isProd ? env.appBaseUrl : null;
  let headerHost: string | null = null;
  if (!raw) {
    try {
      const hdrs = nextHeaders() as unknown;
      if (hdrs && typeof (hdrs as { then?: unknown }).then === "function") {
        throw new Error("headers_async");
      }
      if (hdrs && typeof (hdrs as Headers).get === "function") {
        const host = (hdrs as Headers).get("x-forwarded-host") || (hdrs as Headers).get("host");
        if (host) {
          headerHost = host;
          raw = host;
        }
      }
    } catch {
      // ignore
    }
  } else {
    try {
      const hdrs = nextHeaders() as unknown;
      if (hdrs && typeof (hdrs as { then?: unknown }).then === "function") {
        throw new Error("headers_async");
      }
      if (hdrs && typeof (hdrs as Headers).get === "function") {
        headerHost = (hdrs as Headers).get("x-forwarded-host") || (hdrs as Headers).get("host");
      }
    } catch {
      // ignore
    }
  }

  const isLocalHost = (value: string | null | undefined) => {
    if (!value) return false;
    const host = value.toLowerCase();
    return (
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("0.0.0.0") ||
      host.endsWith(".local")
    );
  };

  if (headerHost && (process.env.NODE_ENV !== "production" || isLocalHost(headerHost))) {
    raw = headerHost;
  }
  if (!raw) raw = DEFAULT_BASE_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  const normalizeZeroHost = (value: string) => {
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.hostname === "0.0.0.0") {
          url.hostname = "127.0.0.1";
          return url.toString().replace(/\/+$/, "");
        }
      } catch {
        // ignore parse errors
      }
      return value;
    }
    if (value.startsWith("0.0.0.0")) {
      return value.replace(/^0\.0\.0\.0/, "127.0.0.1");
    }
    return value;
  };
  const normalized = normalizeZeroHost(trimmed);
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("localhost") || normalized.startsWith("127.0.0.1")) {
    return `http://${normalized}`;
  }
  return `https://${normalized}`;
}
