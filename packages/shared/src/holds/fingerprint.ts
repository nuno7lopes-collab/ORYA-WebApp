export type HoldSubjectType = "SERVICE" | "EVENT" | "SLOT" | "STORE_ORDER";

export type HoldSubjectFingerprintInput = {
  orgId: number | string;
  subjectType: HoldSubjectType | string;
  serviceId?: number | string | null;
  eventId?: number | string | null;
  orderId?: number | string | null;
  startAtISO: string;
  durationMinutes: number | string;
  resourceIds?: Array<number | string | null | undefined>;
  professionalId?: number | string | null;
};

function normalizePositiveInt(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.trunc(parsed));
  }
  return trimmed;
}

function normalizeStartAtIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function normalizeResourceIds(input: HoldSubjectFingerprintInput["resourceIds"]): string[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const normalized = input.map((value) => normalizePositiveInt(value)).filter((value) => value.length > 0);
  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" }));
  return unique;
}

function resolveSubjectId(input: HoldSubjectFingerprintInput): string {
  return (
    normalizePositiveInt(input.serviceId) ||
    normalizePositiveInt(input.eventId) ||
    normalizePositiveInt(input.orderId)
  );
}

function buildUtf8Bytes(input: string): number[] {
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(input));
  }
  const encoded = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    bytes.push(encoded.charCodeAt(i));
  }
  return bytes;
}

function rightRotate(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(input: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ] as const;

  const H = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];

  const bytes = buildUtf8Bytes(input);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0x00);
  }
  const bitLengthHigh = Math.floor(bitLength / 0x100000000);
  const bitLengthLow = bitLength >>> 0;
  bytes.push((bitLengthHigh >>> 24) & 0xff);
  bytes.push((bitLengthHigh >>> 16) & 0xff);
  bytes.push((bitLengthHigh >>> 8) & 0xff);
  bytes.push(bitLengthHigh & 0xff);
  bytes.push((bitLengthLow >>> 24) & 0xff);
  bytes.push((bitLengthLow >>> 16) & 0xff);
  bytes.push((bitLengthLow >>> 8) & 0xff);
  bytes.push(bitLengthLow & 0xff);

  const w = new Array<number>(64).fill(0);
  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = chunkStart + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((value) => value.toString(16).padStart(8, "0")).join("");
}

export function buildHoldSubjectFingerprintSeed(input: HoldSubjectFingerprintInput): string {
  const orgId = normalizePositiveInt(input.orgId);
  const subjectType = String(input.subjectType || "").trim().toUpperCase();
  const subjectId = resolveSubjectId(input);
  const startAtISO = normalizeStartAtIso(input.startAtISO);
  const durationMinutes = normalizePositiveInt(input.durationMinutes);
  const resources = normalizeResourceIds(input.resourceIds);
  const professionalId = normalizePositiveInt(input.professionalId);

  return [
    `org:${orgId}`,
    `type:${subjectType}`,
    `service:${subjectId}`,
    `start:${startAtISO}`,
    `duration:${durationMinutes}`,
    `resources:${resources.join(",")}`,
    `professional:${professionalId}`,
  ].join("|");
}

export function buildHoldSubjectFingerprint(input: HoldSubjectFingerprintInput): string {
  return sha256Hex(buildHoldSubjectFingerprintSeed(input));
}
