import crypto from "crypto";

export type CrmAbVariantChannel = "IN_APP" | "EMAIL" | "BOTH";

export type CrmAbVariant = {
  id: string;
  label: string;
  weight: number;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  emailSubject?: string;
  channel?: CrmAbVariantChannel;
  delayMinutes?: number;
};

export type CrmAbTestConfig = {
  enabled: boolean;
  key: string | null;
  holdoutPercent: number;
  variants: CrmAbVariant[];
};

export type CrmAbAssignment = {
  enabled: boolean;
  bucket: number;
  holdout: boolean;
  variantId: string | null;
  variant: CrmAbVariant | null;
  key: string | null;
};

export type CrmAbMessageBase = {
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  emailSubject: string;
};

export type CrmAbMessageResolved = CrmAbMessageBase & {
  channel: CrmAbVariantChannel;
  delayMinutes: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChannel(value: unknown): CrmAbVariantChannel | undefined {
  if (typeof value !== "string") return undefined;
  const token = value.trim().toUpperCase();
  if (token === "IN_APP" || token === "EMAIL" || token === "BOTH") {
    return token;
  }
  return undefined;
}

function normalizedSeedBucket(seed: string) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const prefix = hash.slice(0, 12);
  const value = Number.parseInt(prefix, 16);
  if (!Number.isFinite(value)) return 0;
  const max = 16 ** prefix.length - 1;
  return (value / max) * 100;
}

export function normalizeCrmAbTestConfig(raw: unknown): CrmAbTestConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      enabled: false,
      key: null,
      holdoutPercent: 0,
      variants: [],
    };
  }

  const data = raw as Record<string, unknown>;
  const enabled = data.enabled === true;
  const key = parseString(data.key);
  const holdoutPercent = clamp(parseNumber(data.holdoutPercent) ?? 0, 0, 95);

  const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
  const variants: CrmAbVariant[] = variantsRaw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const variant = entry as Record<string, unknown>;
      const id = parseString(variant.id) ?? `V${index + 1}`;
      const label = parseString(variant.label) ?? id;
      const weight = clamp(parseNumber(variant.weight) ?? 1, 0.01, 1000);
      const delayMinutes = clamp(Math.trunc(parseNumber(variant.delayMinutes) ?? 0), 0, 7 * 24 * 60);

      return {
        id,
        label,
        weight,
        ...(parseString(variant.title) ? { title: parseString(variant.title)! } : {}),
        ...(parseString(variant.body) ? { body: parseString(variant.body)! } : {}),
        ...(parseString(variant.ctaLabel) ? { ctaLabel: parseString(variant.ctaLabel)! } : {}),
        ...(parseString(variant.ctaUrl) ? { ctaUrl: parseString(variant.ctaUrl)! } : {}),
        ...(parseString(variant.emailSubject) ? { emailSubject: parseString(variant.emailSubject)! } : {}),
        ...(normalizeChannel(variant.channel) ? { channel: normalizeChannel(variant.channel)! } : {}),
        ...(delayMinutes > 0 ? { delayMinutes } : {}),
      } satisfies CrmAbVariant;
    })
    .filter((variant): variant is CrmAbVariant => Boolean(variant));

  return {
    enabled: enabled && variants.length >= 2,
    key,
    holdoutPercent,
    variants,
  };
}

export function resolveCrmAbAssignment(params: {
  scope: "campaign" | "journey";
  entityId: string;
  contactId: string;
  config: CrmAbTestConfig;
}): CrmAbAssignment {
  if (!params.config.enabled || params.config.variants.length < 2) {
    return {
      enabled: false,
      bucket: 0,
      holdout: false,
      variantId: null,
      variant: null,
      key: params.config.key,
    };
  }

  const seed = [params.scope, params.entityId, params.contactId, params.config.key ?? "default"].join(":");
  const bucket = normalizedSeedBucket(seed);

  if (bucket < params.config.holdoutPercent) {
    return {
      enabled: true,
      bucket,
      holdout: true,
      variantId: null,
      variant: null,
      key: params.config.key,
    };
  }

  const effectiveBucket =
    params.config.holdoutPercent >= 100
      ? 0
      : ((bucket - params.config.holdoutPercent) / (100 - params.config.holdoutPercent)) * 100;

  const totalWeight = params.config.variants.reduce((sum, variant) => sum + variant.weight, 0);
  let cursor = 0;
  for (const variant of params.config.variants) {
    const normalizedWeight = (variant.weight / totalWeight) * 100;
    cursor += normalizedWeight;
    if (effectiveBucket <= cursor) {
      return {
        enabled: true,
        bucket,
        holdout: false,
        variantId: variant.id,
        variant,
        key: params.config.key,
      };
    }
  }

  const fallback = params.config.variants[params.config.variants.length - 1] ?? null;
  return {
    enabled: true,
    bucket,
    holdout: false,
    variantId: fallback?.id ?? null,
    variant: fallback,
    key: params.config.key,
  };
}

export function resolveCrmAbMessage(params: {
  base: CrmAbMessageBase;
  assignment: CrmAbAssignment;
  fallbackChannel?: CrmAbVariantChannel;
}): CrmAbMessageResolved {
  const variant = params.assignment.variant;
  const fallbackChannel = params.fallbackChannel ?? "BOTH";
  const channel = variant?.channel ?? fallbackChannel;
  const delayMinutes = Math.max(0, Math.trunc(variant?.delayMinutes ?? 0));

  return {
    title: variant?.title ?? params.base.title,
    body: variant?.body ?? params.base.body,
    ctaLabel: variant?.ctaLabel ?? params.base.ctaLabel,
    ctaUrl: variant?.ctaUrl ?? params.base.ctaUrl,
    emailSubject: variant?.emailSubject ?? params.base.emailSubject,
    channel,
    delayMinutes,
  };
}
