import PDFDocument from "pdfkit";
import type { TelemetryExportDataset } from "@/domain/telemetry/export";

type TelemetryExportPdfParams = {
  dataset: TelemetryExportDataset;
  headers: string[];
  rows: string[][];
  rowCount: number;
  title: string;
  scopeLabel: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
  generatedAt?: Date;
  maxRows?: number;
};

const DATASET_LABELS: Record<TelemetryExportDataset, string> = {
  events: "Eventos",
  incidents: "Incidentes",
  rules: "Regras",
  funnels: "Funis",
  funnel_results: "Resultados de funil",
};

const DATASET_PREFERRED_HEADERS: Record<TelemetryExportDataset, string[]> = {
  events: ["occurredAt", "eventName", "sourceType", "severity", "actorType", "organizationId", "correlationId"],
  incidents: ["triggeredAt", "status", "severity", "title", "metricKey", "observedValue", "thresholdValue"],
  rules: ["name", "organizationId", "metricKey", "comparisonOperator", "threshold", "severity", "isActive"],
  funnels: ["name", "organizationId", "isActive", "steps", "updatedAt"],
  funnel_results: ["bucketStart", "funnelId", "organizationId", "stepKey", "enteredCount", "convertedCount", "conversionRateBps"],
};

function truncate(value: string, max = 52) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function formatFilterValue(value: string | number | boolean | null | undefined) {
  if (value === null || typeof value === "undefined") return "n/a";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function resolveColumns(dataset: TelemetryExportDataset, headers: string[]) {
  const preferred = DATASET_PREFERRED_HEADERS[dataset];
  const selected = preferred.filter((key) => headers.includes(key));
  if (selected.length >= 3) {
    return selected;
  }
  return headers.slice(0, Math.min(headers.length, 7));
}

export async function buildTelemetryExportPdf(params: TelemetryExportPdfParams) {
  const generatedAt = params.generatedAt ?? new Date();
  const maxRows = Math.max(1, Math.min(params.maxRows ?? 200, 1000));
  const datasetLabel = DATASET_LABELS[params.dataset] ?? params.dataset;
  const columns = resolveColumns(params.dataset, params.headers);
  const columnIndexes = columns.map((header) => params.headers.indexOf(header)).filter((idx) => idx >= 0);

  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const rowHeight = 16;
  const fontSize = 8;
  const columnWidth = pageWidth / Math.max(1, columnIndexes.length);
  const printableRows = params.rows.slice(0, maxRows);

  doc.fontSize(16).fillColor("#111111").text(params.title, left, doc.y);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#333333");
  doc.text(`Dataset: ${datasetLabel}`);
  doc.text(`Ambito: ${params.scopeLabel}`);
  doc.text(`Gerado em: ${generatedAt.toISOString()}`);
  doc.text(`Linhas carregadas: ${params.rowCount}`);
  doc.text(`Linhas no PDF: ${printableRows.length}`);

  const filters = Object.entries(params.filters ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (filters.length > 0) {
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#111111").text("Filtros");
    doc.fontSize(8).fillColor("#444444");
    for (const [key, value] of filters.slice(0, 16)) {
      doc.text(`${key}: ${formatFilterValue(value)}`);
    }
  }

  doc.moveDown(0.7);
  let y = doc.y;

  const drawHeaderRow = () => {
    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#111111");
    columns.forEach((header, index) => {
      const x = left + index * columnWidth;
      doc.text(truncate(header, 26), x + 2, y, { width: columnWidth - 4, height: rowHeight, lineBreak: false });
    });
    y += rowHeight;
    doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor("#cccccc").stroke();
    y += 4;
    doc.font("Helvetica").fontSize(fontSize).fillColor("#333333");
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= bottomLimit) return;
    doc.addPage();
    y = doc.page.margins.top;
    drawHeaderRow();
  };

  drawHeaderRow();

  for (const row of printableRows) {
    ensureSpace(rowHeight + 4);
    columnIndexes.forEach((rowIndex, columnIndex) => {
      const x = left + columnIndex * columnWidth;
      const raw = row[rowIndex] ?? "";
      const value = truncate(String(raw), 52);
      doc.text(value, x + 2, y, {
        width: columnWidth - 4,
        height: rowHeight,
        lineBreak: false,
      });
    });
    y += rowHeight;
  }

  if (params.rowCount > printableRows.length) {
    ensureSpace(20);
    doc.fontSize(8).fillColor("#666666");
    doc.text(
      `Nota: o PDF inclui apenas as primeiras ${printableRows.length} linhas. Usa CSV para o total.`,
      left,
      y,
    );
    y += 14;
  }

  doc.fontSize(8).fillColor("#666666").text("Documento gerado automaticamente pela ORYA.", left, y + 8);

  return new Promise<Buffer>((resolve) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

