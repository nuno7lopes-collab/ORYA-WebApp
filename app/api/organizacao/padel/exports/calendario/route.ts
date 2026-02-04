export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { formatDateTime, resolveLocale, t } from "@/lib/i18n";
import PDFDocument from "pdfkit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { OrganizationModule } from "@prisma/client";

const buildCalendarPdf = async ({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: Array<{ start: string; court: string; round: string; teams: string; status: string }>;
  locale: string;
}) => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidths = [90, 70, 70, pageWidth - 90 - 70 - 70 - 70, 70];
  const columnX = [
    doc.page.margins.left,
    doc.page.margins.left + columnWidths[0],
    doc.page.margins.left + columnWidths[0] + columnWidths[1],
    doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2],
    doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3],
  ];
  const rowHeight = 18;

  const drawHeader = () => {
    doc.fontSize(16).fillColor("#111").text(title, doc.page.margins.left, doc.y);
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#666").text(t("calendarTitle", locale), doc.page.margins.left, doc.y);
    doc.moveDown(0.8);

    const headerY = doc.y;
    doc.fontSize(10).fillColor("#111");
    [t("dateTimeLabel", locale), t("courtLabel", locale), t("phaseLabel", locale), t("matchLabel", locale), t("statusLabel", locale)].forEach(
      (label, idx) => {
        doc.text(label, columnX[idx], headerY, { width: columnWidths[idx] - 4 });
      },
    );
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
    doc.text(row.start, columnX[0], y, { width: columnWidths[0] - 4 });
    doc.text(row.court, columnX[1], y, { width: columnWidths[1] - 4 });
    doc.text(row.round, columnX[2], y, { width: columnWidths[2] - 4 });
    doc.text(row.teams, columnX[3], y, { width: columnWidths[3] - 4 });
    doc.text(row.status, columnX[4], y, { width: columnWidths[4] - 4 });
    currentY += rowHeight;
  });

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  return buffer;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, slug: true, title: true, timezone: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId },
    include: {
      court: { select: { name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const lang = req.nextUrl.searchParams.get("lang");
  const locale = resolveLocale(lang);

  const rows = matches.map((m) => {
    const start = m.plannedStartAt ?? m.startTime;
    const teamA =
      m.pairingA?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
        .filter(Boolean)
        .join(" / ") || t("pairing", locale);
    const teamB =
      m.pairingB?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
        .filter(Boolean)
        .join(" / ") || t("pairing", locale);
    return {
      start: start ? formatDateTime(start, locale, event.timezone) : "—",
      court: String(m.court?.name || m.courtName || m.courtNumber || m.courtId || t("court", locale)),
      round: m.roundLabel || m.groupLabel || "",
      teams: `${teamA} vs ${teamB}`,
      status: String(m.status),
    };
  });

  const format = (req.nextUrl.searchParams.get("format") || "html").toLowerCase();
  const filenameBase = `padel_calendario_${event.slug || eventId}`;

  if (format === "pdf") {
    const pdf = await buildCalendarPdf({ title: event.title, rows, locale });
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const htmlLang = locale.split("-")[0] || "pt";
  const html = `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="utf-8" />
    <title>Calendário Padel - ${event.title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { margin-top: 0; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #f4f4f4; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>${event.title}</h1>
    <p>${t("calendarTitle", locale)}.</p>
    <table>
      <thead>
        <tr>
          <th>${t("dateTimeLabel", locale)}</th>
          <th>${t("courtLabel", locale)}</th>
          <th>${t("phaseLabel", locale)}</th>
          <th>${t("matchLabel", locale)}</th>
          <th>${t("statusLabel", locale)}</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr>
              <td>${row.start}</td>
              <td>${row.court}</td>
              <td>${row.round}</td>
              <td>${row.teams}</td>
              <td>${row.status}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
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
export const GET = withApiEnvelope(_GET);
