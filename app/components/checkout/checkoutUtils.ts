export function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function formatMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function buildClientFingerprint(input: unknown) {
  try {
    return JSON.stringify(input);
  } catch {
    // Fallback raro (ex.: objeto circular) — valor determinístico.
    return "fp_invalid";
  }
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildDeterministicIdemKey(fingerprint: string | null | undefined) {
  if (!fingerprint || !fingerprint.trim()) return null;
  return `idem_${hashString(fingerprint)}`;
}
