import { NextRequest } from "next/server";
import crypto from "crypto";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function digest(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function safeSecretEquals(provided: string, expected: string) {
  try {
    return crypto.timingSafeEqual(digest(provided), digest(expected));
  } catch {
    return false;
  }
}

export function requireInternalSecret(req: NextRequest | Headers) {
  const headers = req instanceof Headers ? req : req.headers;
  const provided = headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;

  if (!expected || !provided) return false;
  return safeSecretEquals(provided, expected);
}
