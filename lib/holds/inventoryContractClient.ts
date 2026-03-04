"use client";

import { getClientAppEnv } from "@/lib/appEnvClient";

function parseBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isInventoryHoldContractEnabledClient() {
  const explicit = parseBoolean(process.env.NEXT_PUBLIC_FEATURE_INVENTORY_HOLDS);
  if (explicit != null) return explicit;
  return getClientAppEnv() !== "prod";
}
