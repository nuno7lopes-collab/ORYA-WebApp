import "server-only";
import { env } from "@/lib/env";

export function isWidgetsEnabled() {
  return env.widgetsEnabled;
}

export function isPublicApiEnabled() {
  return env.publicApiEnabled;
}
