import { NextRequest } from "next/server";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

export function requireInternalSecret(req: NextRequest | Headers) {
  const headers = req instanceof Headers ? req : req.headers;
  const provided = headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;

  return Boolean(expected && provided && provided === expected);
}
