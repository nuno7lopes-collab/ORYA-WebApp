export const csvEscape = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const needsQuotes = /[",\n\r]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const toCsv = (rows: Array<Array<string | number | Date | null | undefined>>) =>
  rows.map((row) => row.map(csvEscape).join(",")).join("\n");
