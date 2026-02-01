import { env } from "@/lib/env";
import { headers as nextHeaders } from "next/headers";

const DEFAULT_BASE_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  let raw = env.appBaseUrl;
  if (!raw) {
    try {
      const hdrs = nextHeaders();
      if (hdrs && typeof (hdrs as any).then === "function") {
        throw new Error("headers_async");
      }
      const host = (hdrs as Headers).get("x-forwarded-host") || (hdrs as Headers).get("host");
      if (host) raw = host;
    } catch {
      // ignore
    }
  }
  if (!raw) raw = DEFAULT_BASE_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}
