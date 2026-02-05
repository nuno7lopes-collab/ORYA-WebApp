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

const DEFAULT_MATCH_DURATION_MINUTES = 60;

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

const escapeCsv = (value: string) => {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const buildCalendarCsv = (rows: Array<{ startUtc: string; endUtc: string; timezone: string; court: string; round: string; teams: string; status: string }>) => {
  const header = ["startUtc", "endUtc", "timezone", "court", "round", "teams", "status"];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    const line = [
      row.startUtc,
      row.endUtc,
      row.timezone,
      row.court,
      row.round,
      row.teams,
      row.status,
    ]
      .map((value) => escapeCsv(value || ""))
      .join(",");
    lines.push(line);
  });
  return lines.join("\n");
};

const formatIcsDateTime = (date: Date, timeZone?: string | null) => {
  if (!timeZone) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
};

const buildCalendarIcs = ({
  title,
  rows,
  timeZone,
}: {
  title: string;
  rows: Array<{ id: number; start: Date; end: Date; court: string; round: string; teams: string; status: string }>;
  timeZone: string | null;
}) => {
  const now = new Date();
  const dtstamp = formatIcsDateTime(now, null);
  const tzid = timeZone ? `;TZID=${timeZone}` : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ORYA//Padel Calendar//PT",
    `X-WR-CALNAME:${title}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  rows.forEach((row) => {
    const summary = `${row.round ? `${row.round} · ` : ""}${row.teams}`;
    const description = `Jogo de padel${row.status ? ` (${row.status})` : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:padel-${row.id}@orya.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART${tzid}:${formatIcsDateTime(row.start, timeZone)}`,
      `DTEND${tzid}:${formatIcsDateTime(row.end, timeZone)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${row.court}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
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
    const fallbackDuration = m.plannedDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
    const end = m.plannedEndAt
      ? m.plannedEndAt
      : start
        ? new Date(start.getTime() + fallbackDuration * 60 * 1000)
        : null;
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
      id: m.id,
      start: start ? formatDateTime(start, locale, event.timezone) : "—",
      startDate: start,
      endDate: end,
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

  if (format === "csv") {
    const csv = buildCalendarCsv(
      rows
        .filter((row) => row.startDate && row.endDate)
        .map((row) => ({
          startUtc: row.startDate ? row.startDate.toISOString() : "",
          endUtc: row.endDate ? row.endDate.toISOString() : "",
          timezone: event.timezone ?? "UTC",
          court: row.court,
          round: row.round,
          teams: row.teams,
          status: row.status,
        })),
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "ics") {
    const ics = buildCalendarIcs({
      title: event.title,
      timeZone: event.timezone ?? null,
      rows: rows
        .filter((row) => row.startDate && row.endDate)
        .map((row) => ({
          id: row.id,
          start: row.startDate as Date,
          end: row.endDate as Date,
          court: row.court,
          round: row.round,
          teams: row.teams,
          status: row.status,
        })),
    });
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.ics"`,
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
