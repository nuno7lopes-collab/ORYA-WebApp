import { PadelPaymentMode } from "@prisma/client";

export type ParsedPadelImportRow = {
  rowNumber: number;
  categoryId: number | null;
  seed: number | null;
  group: string | null;
  paymentMode: PadelPaymentMode;
  paid: boolean;
  players: [
    { name: string; email: string | null; phone: string | null },
    { name: string; email: string | null; phone: string | null },
  ];
};

export type PadelImportError = { row: number; message: string; field?: string | null };

export type PadelImportParseResult = {
  rows: ParsedPadelImportRow[];
  errors: PadelImportError[];
  invalidRows: Set<number>;
  nonEmptyRows: number;
};

export type PadelImportParseOptions = {
  categoryById: Map<number, { id: number; label: string | null }>;
  categoryByLabel: Map<string, number>;
  defaultCategoryId: number | null;
  fallbackCategoryId: number | null;
};

export const normalizeImportHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const normalizeImportLookup = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const asString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
};

export const resolveImportIdentifier = (name: string, email?: string | null) => {
  if (email) return email.trim().toLowerCase();
  return normalizeImportLookup(name);
};

export const buildImportPairKey = (categoryId: number | null, identifiers: string[]) => {
  if (identifiers.length < 2) return null;
  const categoryKey = Number.isFinite(categoryId) && categoryId ? String(categoryId) : "0";
  return `${categoryKey}|${[...identifiers].sort().join("|")}`;
};

export const resolveImportBoolean = (value: string | null, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = normalizeImportLookup(value);
  const truthy = new Set(["1", "true", "yes", "sim", "paid", "pago"]);
  const falsy = new Set(["0", "false", "no", "nao", "unpaid", "nao_pago"]);
  if (truthy.has(normalized)) return true;
  if (falsy.has(normalized)) return false;
  return fallback;
};

export const resolveImportPaymentMode = (value: string | null) => {
  if (!value) return PadelPaymentMode.FULL;
  const normalized = normalizeImportLookup(value);
  return normalized === "split" || normalized === "partilhado" ? PadelPaymentMode.SPLIT : PadelPaymentMode.FULL;
};

export const resolveImportPositiveInt = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseImportBoolean = (value: string | null, fallback: boolean) => {
  if (!value) return { value: fallback, ok: true };
  const normalized = normalizeImportLookup(value);
  const truthy = new Set(["1", "true", "yes", "sim", "paid", "pago"]);
  const falsy = new Set(["0", "false", "no", "nao", "unpaid", "nao_pago"]);
  if (truthy.has(normalized)) return { value: true, ok: true };
  if (falsy.has(normalized)) return { value: false, ok: true };
  return { value: fallback, ok: false };
};

const parseImportPaymentMode = (value: string | null) => {
  if (!value) return { value: PadelPaymentMode.FULL, ok: true };
  const normalized = normalizeImportLookup(value);
  if (normalized === "split" || normalized === "partilhado") {
    return { value: PadelPaymentMode.SPLIT, ok: true };
  }
  if (["full", "total", "inteiro", "completo"].includes(normalized)) {
    return { value: PadelPaymentMode.FULL, ok: true };
  }
  return { value: PadelPaymentMode.FULL, ok: false };
};

export function parsePadelImportRows(
  rows: Array<Record<string, unknown>>,
  options: PadelImportParseOptions,
): PadelImportParseResult {
  const { categoryById, categoryByLabel, defaultCategoryId, fallbackCategoryId } = options;
  const parsedRows: ParsedPadelImportRow[] = [];
  const errors: PadelImportError[] = [];
  const invalidRows = new Set<number>();
  const seenPairs = new Set<string>();
  let nonEmptyRows = 0;

  const readField = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const value = asString(row[key]);
        if (value) return value;
      }
    }
    return "";
  };

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[normalizeImportHeader(key)] = value;
      return acc;
    }, {});
    const hasContent = Object.values(normalizedRow).some((value) => asString(value));
    if (!hasContent) return;
    nonEmptyRows += 1;

    const rowErrors: PadelImportError[] = [];
    const pushError = (message: string, field?: string) => {
      const entry: PadelImportError = { row: rowNumber, message, field };
      errors.push(entry);
      rowErrors.push(entry);
      invalidRows.add(rowNumber);
    };

    const categoryRaw = readField(normalizedRow, ["categoria", "category", "category_id", "categoryid"]);
    const name1 = readField(normalizedRow, ["player1_name", "jogador1", "jogador_1", "player_1", "player1", "team_a"]);
    const name2 = readField(normalizedRow, ["player2_name", "jogador2", "jogador_2", "player_2", "player2", "team_b"]);
    const email1 = readField(normalizedRow, ["player1_email", "email1", "email_1"]).trim();
    const email2 = readField(normalizedRow, ["player2_email", "email2", "email_2"]).trim();
    const phone1 = readField(normalizedRow, ["player1_phone", "phone1", "phone_1", "telefone1", "telefone_1"]);
    const phone2 = readField(normalizedRow, ["player2_phone", "phone2", "phone_2", "telefone2", "telefone_2"]);
    const seedRaw = readField(normalizedRow, ["seed", "seeding"]);
    const groupRaw = readField(normalizedRow, ["grupo", "group"]);
    const paymentModeRaw = readField(normalizedRow, ["payment_mode", "payment", "pagamento"]);
    const paymentStatusRaw = readField(normalizedRow, ["payment_status", "paid", "pago"]);

    if (!name1) pushError("Falta o nome do jogador 1.", "player1_name");
    if (!name2) pushError("Falta o nome do jogador 2.", "player2_name");
    if (email1 && !EMAIL_REGEX.test(email1)) pushError("Email do jogador 1 invalido.", "player1_email");
    if (email2 && !EMAIL_REGEX.test(email2)) pushError("Email do jogador 2 invalido.", "player2_email");

    let categoryId: number | null = null;
    let categoryInvalid = false;
    if (categoryRaw) {
      const parsed = Number(categoryRaw);
      if (Number.isFinite(parsed)) {
        categoryId = parsed > 0 ? Math.floor(parsed) : null;
      } else {
        const lookup = categoryByLabel.get(normalizeImportLookup(categoryRaw));
        categoryId = lookup ?? null;
      }
      if (!categoryId || !categoryById.has(categoryId)) {
        pushError("Categoria invalida para este evento.", "categoria");
        categoryId = null;
        categoryInvalid = true;
      }
    }
    if (!categoryId) {
      const fallback = fallbackCategoryId && categoryById.has(fallbackCategoryId) ? fallbackCategoryId : null;
      categoryId = defaultCategoryId ?? fallback ?? null;
    }
    if (!categoryId && !categoryInvalid) {
      pushError("Categoria obrigatoria (sem default).", "categoria");
    }

    const seed = resolveImportPositiveInt(seedRaw);
    if (seedRaw && !seed) {
      pushError("Seed invalida. Usa numero positivo.", "seed");
    }

    const group = groupRaw ? groupRaw.trim().toUpperCase() : "";
    const groupLabel = /^[A-Z]$/.test(group) ? group : null;
    if (groupRaw && !groupLabel) {
      pushError("Grupo invalido. Usa A, B, C, ...", "group");
    }

    const paymentModeResult = parseImportPaymentMode(paymentModeRaw || null);
    if (paymentModeRaw && !paymentModeResult.ok) {
      pushError("Modo de pagamento invalido. Usa FULL ou SPLIT.", "payment_mode");
    }
    const paymentStatusResult = parseImportBoolean(paymentStatusRaw || null, true);
    if (paymentStatusRaw && !paymentStatusResult.ok) {
      pushError("Estado de pagamento invalido. Usa paid/pago ou unpaid/nao_pago.", "payment_status");
    }

    if (rowErrors.length > 0) return;

    const idA = resolveImportIdentifier(name1, email1 || null);
    const idB = resolveImportIdentifier(name2, email2 || null);
    const pairKey = buildImportPairKey(categoryId, [idA, idB]);
    if (!pairKey) {
      pushError("Nao foi possivel gerar identificador da dupla.", "pairing");
      return;
    }
    if (seenPairs.has(pairKey)) {
      pushError("Dupla duplicada no ficheiro.", "pairing");
      return;
    }
    seenPairs.add(pairKey);

    parsedRows.push({
      rowNumber,
      categoryId,
      seed,
      group: groupLabel,
      paymentMode: paymentModeResult.value,
      paid: paymentStatusResult.value,
      players: [
        { name: name1.trim(), email: email1 ? email1.trim() : null, phone: phone1 ? phone1.trim() : null },
        { name: name2.trim(), email: email2 ? email2.trim() : null, phone: phone2 ? phone2.trim() : null },
      ],
    });
  });

  return { rows: parsedRows, errors, invalidRows, nonEmptyRows };
}
