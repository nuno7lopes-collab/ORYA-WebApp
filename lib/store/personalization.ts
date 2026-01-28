import { prisma } from "@/lib/prisma";
import { StoreProductOptionType } from "@prisma/client";

export type PersonalizationSelection = {
  optionId: number;
  valueId?: number | null;
  value?: string | number | boolean | null;
};

export type PersonalizationSummaryItem = {
  optionId: number;
  label: string;
  value: string;
};

type OptionSnapshot = {
  id: number;
  productId: number;
  label: string;
  optionType: StoreProductOptionType;
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  priceDeltaCents: number;
};

type OptionValueSnapshot = {
  id: number;
  optionId: number;
  value: string;
  label: string | null;
  priceDeltaCents: number;
};

function extractSelections(personalization: unknown): PersonalizationSelection[] {
  const raw = (personalization as { selections?: unknown })?.selections;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as PersonalizationSelection;
      if (!item.optionId || !Number.isFinite(Number(item.optionId))) return null;
      return {
        optionId: Number(item.optionId),
        valueId: item.valueId ?? null,
        value: item.value ?? null,
      };
    })
    .filter(Boolean) as PersonalizationSelection[];
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatSelectionValue(option: OptionSnapshot, selection: PersonalizationSelection, value?: OptionValueSnapshot | null) {
  if (option.optionType === StoreProductOptionType.SELECT) {
    return value?.label || value?.value || "";
  }
  if (option.optionType === StoreProductOptionType.CHECKBOX) {
    return selection.value === true ? "Sim" : "";
  }
  if (selection.value === null || selection.value === undefined) return "";
  return String(selection.value).trim();
}

export async function validateStorePersonalization(params: {
  productId: number;
  personalization: unknown;
}) {
  const selections = extractSelections(params.personalization);

  const options = await prisma.storeProductOption.findMany({
    where: { productId: params.productId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productId: true,
      label: true,
      optionType: true,
      required: true,
      maxLength: true,
      minValue: true,
      maxValue: true,
      priceDeltaCents: true,
    },
  });

  if (options.length === 0) {
    if (selections.length > 0) {
      return { ok: false as const, error: "Opcao invalida." };
    }
    return { ok: true as const, deltaCents: 0, normalized: { selections: [] }, summary: [] };
  }

  const optionMap = new Map(options.map((option) => [option.id, option]));
  const seen = new Set<number>();
  for (const selection of selections) {
    if (!optionMap.has(selection.optionId)) {
      return { ok: false as const, error: "Opcao invalida." };
    }
    if (seen.has(selection.optionId)) {
      return { ok: false as const, error: "Opcao duplicada." };
    }
    seen.add(selection.optionId);
  }

  const valueIds = selections
    .map((selection) => selection.valueId)
    .filter((valueId): valueId is number => Boolean(valueId));
  const values = valueIds.length
    ? await prisma.storeProductOptionValue.findMany({
        where: { id: { in: valueIds } },
        select: { id: true, optionId: true, value: true, label: true, priceDeltaCents: true },
      })
    : [];
  const valueMap = new Map(values.map((value) => [value.id, value]));

  let deltaCents = 0;
  const normalized: PersonalizationSelection[] = [];
  const summary: PersonalizationSummaryItem[] = [];

  for (const option of options) {
    const selection = selections.find((item) => item.optionId === option.id);
    if (!selection) {
      if (option.required) {
        return { ok: false as const, error: `Opcao obrigatoria: ${option.label}` };
      }
      continue;
    }

    if (option.optionType === StoreProductOptionType.SELECT) {
      if (!selection.valueId) {
        if (option.required) {
          return { ok: false as const, error: `Seleciona: ${option.label}` };
        }
        continue;
      }
      const value = valueMap.get(selection.valueId);
      if (!value || value.optionId !== option.id) {
        return { ok: false as const, error: `Valor invalido: ${option.label}` };
      }
      deltaCents += option.priceDeltaCents + value.priceDeltaCents;
      normalized.push({ optionId: option.id, valueId: value.id });
      summary.push({ optionId: option.id, label: option.label, value: value.label || value.value });
      continue;
    }

    if (option.optionType === StoreProductOptionType.CHECKBOX) {
      const checked = selection.value === true;
      if (!checked) {
        if (option.required) {
          return { ok: false as const, error: `Seleciona: ${option.label}` };
        }
        continue;
      }
      deltaCents += option.priceDeltaCents;
      normalized.push({ optionId: option.id, value: true });
      summary.push({ optionId: option.id, label: option.label, value: "Sim" });
      continue;
    }

    if (option.optionType === StoreProductOptionType.NUMBER) {
      const numeric = coerceNumber(selection.value);
      if (numeric === null) {
        if (option.required) {
          return { ok: false as const, error: `Preenche: ${option.label}` };
        }
        continue;
      }
      if (option.minValue !== null && numeric < option.minValue) {
        return { ok: false as const, error: `Valor minimo: ${option.label}` };
      }
      if (option.maxValue !== null && numeric > option.maxValue) {
        return { ok: false as const, error: `Valor maximo: ${option.label}` };
      }
      deltaCents += option.priceDeltaCents;
      normalized.push({ optionId: option.id, value: numeric });
      summary.push({ optionId: option.id, label: option.label, value: String(numeric) });
      continue;
    }

    const textValue = selection.value === null || selection.value === undefined ? "" : String(selection.value).trim();
    if (!textValue) {
      if (option.required) {
        return { ok: false as const, error: `Preenche: ${option.label}` };
      }
      continue;
    }
    if (option.maxLength !== null && textValue.length > option.maxLength) {
      return { ok: false as const, error: `Texto demasiado longo: ${option.label}` };
    }
    deltaCents += option.priceDeltaCents;
    normalized.push({ optionId: option.id, value: textValue });
    summary.push({ optionId: option.id, label: option.label, value: textValue });
  }

  return { ok: true as const, deltaCents, normalized: { selections: normalized }, summary };
}

export function buildPersonalizationSummary(params: {
  personalization: unknown;
  options: Array<Pick<OptionSnapshot, "id" | "label" | "optionType">>;
  values: Array<Pick<OptionValueSnapshot, "id" | "optionId" | "value" | "label" | "priceDeltaCents">>;
}) {
  const selections = extractSelections(params.personalization);
  if (!selections.length) return [];
  const optionMap = new Map(params.options.map((option) => [option.id, option]));
  const valueMap = new Map(params.values.map((value) => [value.id, value]));

  return selections
    .map((selection) => {
      const option = optionMap.get(selection.optionId);
      if (!option) return null;
      const value = selection.valueId ? valueMap.get(selection.valueId) ?? null : null;
      const formatted = formatSelectionValue(option as OptionSnapshot, selection, value);
      if (!formatted) return null;
      return {
        optionId: option.id,
        label: option.label,
        value: formatted,
      } satisfies PersonalizationSummaryItem;
    })
    .filter(Boolean) as PersonalizationSummaryItem[];
}
