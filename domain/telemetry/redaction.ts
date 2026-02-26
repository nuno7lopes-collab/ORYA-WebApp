const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(email|phone|token|authorization|cookie|password|iban|nif|vat|tax|secret|api[_-]?key|card|cvv|cvc)/i;

type RedactionOptions = {
  maxDepth?: number;
  maxArraySize?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampString(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

function sanitizeValue(
  value: unknown,
  keyHint: string | undefined,
  depth: number,
  seen: WeakSet<object>,
  opts: Required<RedactionOptions>,
): unknown {
  if (value === null || value === undefined) return value;

  if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return clampString(value, opts.maxStringLength);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: clampString(value.message, opts.maxStringLength),
      stack: value.stack ? clampString(value.stack, opts.maxStringLength) : null,
    };
  }

  if (depth >= opts.maxDepth) {
    return "[DEPTH_LIMIT]";
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, opts.maxArraySize).map((entry) =>
      sanitizeValue(entry, undefined, depth + 1, seen, opts),
    );
    if (value.length > opts.maxArraySize) {
      items.push(`[TRUNCATED_${value.length - opts.maxArraySize}]`);
    }
    return items;
  }

  if (!isRecord(value)) {
    return String(value);
  }

  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  const entries = Object.entries(value).slice(0, opts.maxObjectKeys);
  const result: Record<string, unknown> = {};
  for (const [key, entry] of entries) {
    result[key] = sanitizeValue(entry, key, depth + 1, seen, opts);
  }
  if (Object.keys(value).length > opts.maxObjectKeys) {
    result.__truncated_keys__ = Object.keys(value).length - opts.maxObjectKeys;
  }
  return result;
}

export function sanitizeTelemetryPayload(
  value: unknown,
  options?: RedactionOptions,
): Record<string, unknown> {
  const opts: Required<RedactionOptions> = {
    maxDepth: options?.maxDepth ?? 8,
    maxArraySize: options?.maxArraySize ?? 60,
    maxObjectKeys: options?.maxObjectKeys ?? 120,
    maxStringLength: options?.maxStringLength ?? 3000,
  };

  if (!isRecord(value)) {
    return {
      value: sanitizeValue(value, "value", 0, new WeakSet<object>(), opts),
    };
  }

  return sanitizeValue(value, undefined, 0, new WeakSet<object>(), opts) as Record<
    string,
    unknown
  >;
}
