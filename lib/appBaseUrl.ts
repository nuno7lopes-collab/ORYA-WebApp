import { env } from "@/lib/env";

const DEFAULT_BASE_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  const raw = env.appBaseUrl || DEFAULT_BASE_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}
