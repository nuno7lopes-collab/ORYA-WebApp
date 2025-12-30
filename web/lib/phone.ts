// Utils partilhados para normalizar/validar telefones de forma consistente

// Remove caracteres inválidos, permitindo apenas dígitos e um único "+" no início
export function sanitizePhone(input: string): string {
  let cleaned = input.replace(/[^\d+]/g, "");
  if (cleaned.includes("+")) {
    const firstPlus = cleaned.indexOf("+");
    cleaned = "+" + cleaned.slice(firstPlus + 1).replace(/\+/g, "");
  }
  return cleaned;
}

// Validação: dígitos com opcional "+" no início, 6 a 15 dígitos totais
export function isValidPhone(input: string): boolean {
  const value = sanitizePhone(input);
  if (!value) return false;
  return /^\+?\d{6,15}$/.test(value);
}

// Normalização simples: devolve o valor sanitizado (já usado para guardar)
export function normalizePhone(input: string): string {
  return sanitizePhone(input);
}
