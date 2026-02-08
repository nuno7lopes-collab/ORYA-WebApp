import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BLUEPRINT_PATH = path.join(ROOT, "docs", "blueprint.md");
const REPORT_DIR = path.join(ROOT, "reports");
const OUT_CSV = path.join(REPORT_DIR, "blueprint_to_be_inventory.csv");
const OUT_MD = path.join(REPORT_DIR, "blueprint_to_be_inventory.md");

function normalizeDashes(text) {
  return text.replace(/[\u2010-\u2015\u2212]/g, "-");
}

function hasToBe(title) {
  const normalized = normalizeDashes(title).toUpperCase();
  return normalized.includes("TO-BE");
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, '""')}"`;
  }
  return str;
}

function flushParagraph(items, paragraphBuffer, paragraphStartLine, sectionPath) {
  if (!paragraphBuffer.length) return null;
  const text = paragraphBuffer.join(" ").trim();
  if (text) {
    items.push({
      sectionPath,
      lineNo: paragraphStartLine,
      kind: "paragraph",
      text,
    });
  }
  return null;
}

if (!fs.existsSync(BLUEPRINT_PATH)) {
  console.error("Missing docs/blueprint.md");
  process.exit(1);
}

const content = fs.readFileSync(BLUEPRINT_PATH, "utf8");
const lines = content.split(/\r?\n/);

const items = [];
const headingStack = [];
let inCodeBlock = false;
let toBeRootLevel = null;
let paragraphBuffer = [];
let paragraphStartLine = null;

function currentSectionPath() {
  return headingStack.map((h) => h.title).join(" > ");
}

for (let idx = 0; idx < lines.length; idx += 1) {
  const line = lines[idx];
  const lineNo = idx + 1;
  const trimmed = line.trim();

  if (trimmed.startsWith("```")) {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];
    inCodeBlock = !inCodeBlock;
    continue;
  }
  if (inCodeBlock) continue;

  const headingMatch = /^#{1,6}\s+(.*)$/.exec(trimmed);
  if (headingMatch) {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];

    const level = headingMatch[0].split(" ")[0].length;
    const title = headingMatch[1].trim();

    while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
      headingStack.pop();
    }
    headingStack.push({ level, title });

    if (toBeRootLevel !== null && level <= toBeRootLevel) {
      toBeRootLevel = null;
    }

    if (hasToBe(title)) {
      toBeRootLevel = level;
    }

    if (toBeRootLevel !== null) {
      items.push({
        sectionPath: currentSectionPath(),
        lineNo,
        kind: "heading",
        text: title,
      });
    }

    continue;
  }

  if (toBeRootLevel === null) continue;

  if (/^[-_]{3,}$/.test(trimmed) || trimmed === "⸻") {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];
    paragraphStartLine = null;
    continue;
  }

  const bulletMatch = /^([-*•])\s+(.*)$/.exec(trimmed);
  const numberedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);
  if (bulletMatch || numberedMatch) {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];
    const text = (bulletMatch ? bulletMatch[2] : numberedMatch[1]).trim();
    if (text) {
      items.push({
        sectionPath: currentSectionPath(),
        lineNo,
        kind: "bullet",
        text,
      });
    }
    continue;
  }

  const isTableSeparator = /^\|?[\s:-]+\|[\s|:-]*$/.test(trimmed);
  const isTableRow = trimmed.includes("|") && (trimmed.startsWith("|") || trimmed.endsWith("|") || isTableSeparator);
  if (isTableRow) {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];
    if (trimmed) {
      items.push({
        sectionPath: currentSectionPath(),
        lineNo,
        kind: "table",
        text: trimmed,
      });
    }
    continue;
  }

  if (!trimmed) {
    paragraphStartLine = flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());
    paragraphBuffer = [];
    paragraphStartLine = null;
    continue;
  }

  if (!paragraphBuffer.length) {
    paragraphStartLine = lineNo;
  }
  paragraphBuffer.push(trimmed);
}

flushParagraph(items, paragraphBuffer, paragraphStartLine, currentSectionPath());

fs.mkdirSync(REPORT_DIR, { recursive: true });

const csvRows = ["section_path,line_no,kind,text"];
for (const item of items) {
  csvRows.push(
    [item.sectionPath, item.lineNo, item.kind, item.text]
      .map(csvEscape)
      .join(","),
  );
}
fs.writeFileSync(OUT_CSV, csvRows.join("\n") + "\n", "utf8");

const now = new Date().toISOString();
const mdLines = [
  "# Blueprint TO-BE Inventory",
  "",
  `Generated: ${now}`,
  `Source: ${path.relative(ROOT, BLUEPRINT_PATH)}`,
  "",
  "## Items",
];

for (const item of items) {
  mdLines.push(`- L${item.lineNo} | ${item.sectionPath} | ${item.kind} | ${item.text}`);
}

fs.writeFileSync(OUT_MD, mdLines.join("\n"), "utf8");

console.log("Blueprint TO-BE inventory: OK");
