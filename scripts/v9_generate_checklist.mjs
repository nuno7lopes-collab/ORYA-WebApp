import fs from "node:fs";

const sources = [
  { path: "docs/v9_close_plan.md", label: "v9_close_plan" },
  { path: "docs/v9_ssot_registry.md", label: "v9_ssot_registry" },
  { path: "docs/orya_blueprint_v9_final.md", label: "orya_blueprint_v9_final" },
];

function detectStatus(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (/^```/.test(trimmed)) return "N/A";
  if (/^#{1,6}\s/.test(trimmed)) return "N/A";
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return "N/A";

  if (/^- \[(x|X)\]\s/.test(trimmed)) return "DONE";
  if (/^- \[ \]\s/.test(trimmed)) return "TODO";

  if (/\bStatus\b.*:\s*DONE\b/i.test(trimmed)) return "DONE";
  if (/\bStatus\b.*:\s*TODO\b/i.test(trimmed)) return "TODO";

  if (/^\s*[-*+]\s+/.test(trimmed)) return "TODO";
  if (/^\s*\d+[.)]\s+/.test(trimmed)) return "TODO";

  return "N/A";
}

const now = new Date().toISOString().slice(0, 10);
let output = "# V9 Close Checklist (Generated)\n\n";
output += `Generated: ${now}\n`;
output += "Regenerate with: `node scripts/v9_generate_checklist.mjs`\n\n";

for (const source of sources) {
  const raw = fs.readFileSync(source.path, "utf8");
  const lines = raw.split(/\r?\n/);
  output += `## Source: ${source.path}\n`;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    if (!trimmed) continue;
    const status = detectStatus(trimmed) ?? "N/A";
    output += `- [${status}] L${i + 1}: ${trimmed}\n`;
  }
  output += "\n";
}

fs.writeFileSync("docs/v9_close_checklist.md", output);
console.log("Generated docs/v9_close_checklist.md");
