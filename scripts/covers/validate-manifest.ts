#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { REAL_COVER_LIBRARY } = require("../../lib/coverLibrary");

const ROOT = process.cwd();
const PUBLIC_DIR = path.resolve(ROOT, "public");

const ALLOWED_CATEGORIES = new Set(["EVENTOS", "PADEL", "RESERVAS", "GERAL"]);
const ALLOWED_SCENARIOS = new Set(["TOURNAMENT", "EVENT", "RESERVATION", "GENERAL"]);
const ALLOWED_BUSINESS = new Set(["CLUB", "BAR", "RESTAURANT", "HOTEL", "ACADEMY", "GENERAL"]);

const KEBAB_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|jpeg|png|webp)$/;

const errors: string[] = [];
const warnings: string[] = [];
const ids = new Set<string>();

const resolvePublicPath = (url: string) => path.join(PUBLIC_DIR, url.replace(/^\//, ""));
const filenameFromUrl = (url: string) => path.basename(url.split("?")[0] || "");

const library = REAL_COVER_LIBRARY as Array<Record<string, any>>;

library.forEach((entry: Record<string, any>, index: number) => {
  const label = entry.label || entry.id || `#${index + 1}`;

  if (!entry.id) {
    errors.push(`[${label}] id em falta.`);
  } else if (ids.has(entry.id)) {
    errors.push(`[${label}] id duplicado: ${entry.id}.`);
  } else {
    ids.add(entry.id);
  }

  if (entry.category && !ALLOWED_CATEGORIES.has(entry.category)) {
    errors.push(`[${label}] category inválida: ${entry.category}.`);
  }

  if (!entry.scenario) {
    errors.push(`[${label}] scenario em falta.`);
  } else if (!ALLOWED_SCENARIOS.has(entry.scenario)) {
    errors.push(`[${label}] scenario inválido: ${entry.scenario}.`);
  }

  if (!entry.businessType) {
    errors.push(`[${label}] businessType em falta.`);
  } else if (!ALLOWED_BUSINESS.has(entry.businessType)) {
    errors.push(`[${label}] businessType inválido: ${entry.businessType}.`);
  }

  if (!entry.useCase || !Array.isArray(entry.useCase) || entry.useCase.length === 0) {
    errors.push(`[${label}] useCase em falta.`);
  } else {
    entry.useCase.forEach((useCase: string) => {
      if (!useCase.startsWith("cover:")) {
        warnings.push(`[${label}] useCase fora do padrão cover:* (${useCase}).`);
      }
    });
  }

  if (typeof entry.priority !== "number") {
    errors.push(`[${label}] priority em falta; default esperado (ex: 100).`);
  }

  if (typeof entry.active !== "boolean") {
    errors.push(`[${label}] active em falta ou inválido (esperado boolean).`);
  }

  if (entry.imageUrl) {
    if (entry.imageUrl.startsWith("/")) {
      const full = resolvePublicPath(entry.imageUrl);
      if (!fs.existsSync(full)) {
        errors.push(`[${label}] imageUrl não existe: ${entry.imageUrl}.`);
      } else {
        const filename = filenameFromUrl(entry.imageUrl);
        if (!KEBAB_FILE.test(filename)) {
          errors.push(`[${label}] filename inválido (kebab-case ascii): ${filename}.`);
        }
      }
    } else if (!entry.imageUrl.startsWith("http")) {
      warnings.push(`[${label}] imageUrl não parece URL absoluta: ${entry.imageUrl}.`);
    }
  } else {
    errors.push(`[${label}] imageUrl em falta.`);
  }

  if (entry.thumbUrl) {
    if (entry.thumbUrl.startsWith("/")) {
      const full = resolvePublicPath(entry.thumbUrl);
      if (!fs.existsSync(full)) {
        errors.push(`[${label}] thumbUrl não existe: ${entry.thumbUrl}.`);
      } else {
        const filename = filenameFromUrl(entry.thumbUrl);
        if (!filename.endsWith(".thumb.jpg")) {
          errors.push(`[${label}] thumb filename inválido (esperado *.thumb.jpg): ${filename}.`);
        }
      }
    } else if (!entry.thumbUrl.startsWith("http")) {
      warnings.push(`[${label}] thumbUrl não parece URL absoluta: ${entry.thumbUrl}.`);
    }
  } else {
    errors.push(`[${label}] thumbUrl em falta.`);
  }
});

if (errors.length > 0) {
  console.error("Erros:");
  errors.forEach((err) => console.error(`- ${err}`));
}

if (warnings.length > 0) {
  console.warn("Avisos:");
  warnings.forEach((warn) => console.warn(`- ${warn}`));
}

if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Manifest validado sem erros críticos.");
}
