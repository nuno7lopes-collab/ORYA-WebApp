// lib/money.ts
const EUR_NUMBER_FORMATTER = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formata um valor em EUR para apresentação (ex.: 24,95 €).
 */
export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";

  // Intl usa espaços não separáveis em PT; trocamos para espaço normal para evitar chars estranhos.
  const formatted = EUR_NUMBER_FORMATTER.format(amount).replace(/\u00A0/g, " ");
  return `${formatted} €`;
}

/**
 * Converte um valor em cêntimos para euros mantendo float com 2 casas.
 */
export function centsToEuro(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return null;
  return cents / 100;
}
