export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import PDFDocument from "pdfkit";

const pairingLabel = (
  slots?: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }>,
) => {
  const names =
    slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "—";
};

const formatScore = (scoreSets?: unknown, scoreRaw?: Record<string, unknown> | null) => {
  const sets = Array.isArray(scoreSets) ? (scoreSets as Array<{ teamA: number; teamB: number }>) : [];
  if (sets.length > 0) {
    return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  const rawSets = Array.isArray(scoreRaw?.sets) ? (scoreRaw?.sets as Array<{ teamA: number; teamB: number }>) : [];
  if (rawSets.length > 0) {
    return rawSets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  return "—";
};

const parseRoundMeta = (label: string) => {
  const prefix = label.startsWith("A ") ? "A " : label.startsWith("B ") ? "B " : "";
  const base = prefix ? label.slice(2) : label;
  let size: number | null = null;
  let order: number | null = null;
  if (/^L\\d+$/i.test(base)) {
    const parsed = Number(base.slice(1));
    order = Number.isFinite(parsed) ? parsed : null;
  } else if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
    order = Number.MAX_SAFE_INTEGER;
  } else if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
    order = Number.MAX_SAFE_INTEGER - 1;
  } else if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  }
  if (size === null) {
    if (base === "QUARTERFINAL") size = 8;
    if (base === "SEMIFINAL") size = 4;
    if (base === "FINAL") size = 2;
  }
  return { prefix, size, order };
};

const formatRoundLabel = (label: string) => {
  const trimmed = label.trim();
  const prefix = trimmed.startsWith("A ") ? "A " : trimmed.startsWith("B ") ? "B " : "";
  const base = prefix ? trimmed.slice(2).trim() : trimmed;
  if (/^L\\d+$/i.test(base)) return `${prefix}Ronda ${base.slice(1)}`;
  if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) return `${prefix}Grande Final 2`;
  if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) return `${prefix}Grande Final`;
  return label;
};

const sortRoundLabels = (labels: string[]) =>
  labels.sort((a, b) => {
    const aMeta = parseRoundMeta(a);
    const bMeta = parseRoundMeta(b);
    if (aMeta.prefix !== bMeta.prefix) return aMeta.prefix.localeCompare(bMeta.prefix);
    const aOrder = aMeta.order ?? (aMeta.size !== null ? -aMeta.size : Number.MAX_SAFE_INTEGER - 1);
    const bOrder = bMeta.order ?? (bMeta.size !== null ? -bMeta.size : Number.MAX_SAFE_INTEGER - 1);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });

const buildBracketPdf = async ({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ category: string; round: string; teamA: string; teamB: string; score: string; status: string }>;
}) => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidths = [80, 70, (pageWidth - 80 - 70 - 70 - 60) / 2, (pageWidth - 80 - 70 - 70 - 60) / 2, 70, 60];
  const columnX = [
    doc.page.margins.left,
    doc.page.margins.left + columnWidths[0],
    doc.page.margins.left + columnWidths[0] + columnWidths[1],
    doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2],
    doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3],
    doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4],
  ];
  const rowHeight = 18;

  const drawHeader = () => {
    doc.fontSize(16).fillColor("#111").text(title, doc.page.margins.left, doc.y);
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#666").text("Bracket / Poster", doc.page.margins.left, doc.y);
    doc.moveDown(0.8);

    const headerY = doc.y;
    doc.fontSize(10).fillColor("#111");
    ["Categoria", "Round", "Equipa A", "Equipa B", "Score", "Estado"].forEach((label, idx) => {
      doc.text(label, columnX[idx], headerY, { width: columnWidths[idx] - 4 });
    });
    doc.moveDown(0.6);
    doc.strokeColor("#e0e0e0")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.4);
  };

  drawHeader();
  let currentY = doc.y;

  rows.forEach((row) => {
    if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
      currentY = doc.y;
    }
    const y = currentY;
    doc.fontSize(9).fillColor("#111");
    doc.text(row.category, columnX[0], y, { width: columnWidths[0] - 4 });
    doc.text(row.round, columnX[1], y, { width: columnWidths[1] - 4 });
    doc.text(row.teamA, columnX[2], y, { width: columnWidths[2] - 4 });
    doc.text(row.teamB, columnX[3], y, { width: columnWidths[3] - 4 });
    doc.text(row.score, columnX[4], y, { width: columnWidths[4] - 4 });
    doc.text(row.status, columnX[5], y, { width: columnWidths[5] - 4 });
    currentY += rowHeight;
  });

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  return buffer;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, slug: true, title: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, roundType: "KNOCKOUT" },
    include: {
      category: { select: { label: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
  });

  const categoryMap = new Map<string, typeof matches>();
  matches.forEach((match) => {
    const key = match.category?.label ?? "Sem categoria";
    if (!categoryMap.has(key)) categoryMap.set(key, []);
    categoryMap.get(key)!.push(match);
  });

  const categories = Array.from(categoryMap.entries()).map(([label, items]) => {
    const roundLabels = Array.from(new Set(items.map((m) => m.roundLabel || "Bracket")));
    const sortedRounds = sortRoundLabels(roundLabels);
    const rounds = sortedRounds.map((roundLabel) => ({
      label: roundLabel,
      matches: items.filter((m) => (m.roundLabel || "Bracket") === roundLabel),
    }));
    return { label, rounds };
  });

  const rows = categories.flatMap((category) =>
    category.rounds.flatMap((round) =>
      round.matches.map((m) => {
        const scoreObj = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : null;
        return {
          category: category.label,
          round: formatRoundLabel(round.label),
          teamA: pairingLabel(m.pairingA?.slots),
          teamB: pairingLabel(m.pairingB?.slots),
          score: formatScore(m.scoreSets, scoreObj),
          status: String(m.status),
        };
      }),
    ),
  );

  const format = (req.nextUrl.searchParams.get("format") || "html").toLowerCase();
  const filenameBase = `padel_bracket_${event.slug || eventId}`;

  if (format === "pdf") {
    const pdf = await buildBracketPdf({ title: event.title, rows });
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <title>Bracket Padel - ${event.title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 6px; }
      h2 { font-size: 14px; margin-top: 20px; }
      .rounds { display: flex; gap: 16px; align-items: flex-start; }
      .round { flex: 1; min-width: 180px; }
      .round h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
      .match { border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; }
      .team { font-size: 12px; }
      .score { font-size: 11px; color: #444; margin-top: 4px; }
      .status { font-size: 10px; color: #777; margin-top: 2px; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>${event.title}</h1>
    <p>Bracket / Poster</p>
    ${categories
      .map(
        (category) => `
      <section>
        <h2>${category.label}</h2>
        <div class="rounds">
          ${category.rounds
            .map(
              (round) => `
            <div class="round">
              <h3>${formatRoundLabel(round.label)}</h3>
              ${round.matches
                .map((m) => {
                  const scoreObj = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : null;
                  return `
                <div class="match">
                  <div class="team">${pairingLabel(m.pairingA?.slots)}</div>
                  <div class="team">${pairingLabel(m.pairingB?.slots)}</div>
                  <div class="score">${formatScore(m.scoreSets, scoreObj)}</div>
                  <div class="status">${String(m.status)}</div>
                </div>`;
                })
                .join("")}
            </div>`,
            )
            .join("")}
        </div>
      </section>`,
      )
      .join("")}
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
