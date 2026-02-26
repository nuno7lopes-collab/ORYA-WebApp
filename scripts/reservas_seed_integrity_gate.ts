import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runSeedIntegrityGate } from "../lib/reservas/seedIntegrityGate";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "reports", "reservas_seed_integrity_gate_latest.json");

function ensureReportDir() {
  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  const report = runSeedIntegrityGate(ROOT);
  ensureReportDir();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (report.violations.length > 0) {
    console.error("Reservas seed integrity gate falhou:");
    for (const violation of report.violations) {
      const line = typeof violation.line === "number" ? `:${violation.line}` : "";
      console.error(`- [${violation.rule}] ${violation.file}${line} -> ${violation.message}`);
    }
    console.error(`Relatório: ${path.relative(ROOT, REPORT_PATH)}`);
    process.exit(1);
  }

  console.log(`Reservas seed integrity gate: OK (${report.scannedFiles} ficheiros verificados)`);
}

main();
