import crypto from "crypto";

export function hashApiKey(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("hex");
  const prefix = secret.slice(0, 8);
  const plaintext = `orya_pk_${prefix}_${secret}`;
  return { plaintext, keyPrefix: prefix, keyHash: hashApiKey(plaintext) };
}
