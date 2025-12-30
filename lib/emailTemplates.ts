type PurchaseEmailPayload = {
  eventTitle: string;
  eventSlug: string;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
  ticketsCount: number;
  ticketUrl: string;
};

type OwnerTransferEmailPayload = {
  organizerName: string;
  actorName: string;
  confirmUrl: string;
  expiresAt?: Date | null;
};

type OfficialEmailVerificationPayload = {
  organizerName: string;
  confirmUrl: string;
  expiresAt?: Date | null;
  pendingEmail: string;
};

export function renderPurchaseConfirmationEmail(payload: PurchaseEmailPayload) {
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const startStr = payload.startsAt
    ? formatter.format(new Date(payload.startsAt))
    : null;
  const endStr = payload.endsAt ? formatter.format(new Date(payload.endsAt)) : null;

  const dateLine = startStr
    ? endStr
      ? `${startStr} – ${endStr}`
      : startStr
    : "Data a anunciar";

  const whereLine = payload.locationName?.trim() || "Local a anunciar";

  return {
    subject: `🎟️ Bilhetes confirmados – ${payload.eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="color:#111827;">Obrigado pela tua compra!</h2>
        <p>Os teus bilhetes para <strong>${payload.eventTitle}</strong> estão confirmados.</p>
        <ul>
          <li><strong>Data & Hora:</strong> ${dateLine}</li>
          <li><strong>Local:</strong> ${whereLine}</li>
          <li><strong>Quantidade:</strong> ${payload.ticketsCount} bilhete(s)</li>
        </ul>
        <p>Podes ver os bilhetes e o QR diretamente aqui:</p>
        <p><a href="${payload.ticketUrl}" style="color:#2563eb;font-weight:bold;">Ver bilhetes</a></p>
        <p style="margin-top:24px; font-size:12px; color:#6b7280;">Se não foste tu a fazer esta compra, contacta a equipa ORYA.</p>
      </div>
    `,
    text: `Obrigado pela tua compra!
Evento: ${payload.eventTitle}
Data & Hora: ${dateLine}
Local: ${whereLine}
Bilhetes: ${payload.ticketsCount}
Ver bilhetes: ${payload.ticketUrl}
`,
  };
}

type TournamentEmailPayload = {
  eventTitle: string;
  scheduleHtml?: string;
  scheduleText?: string;
  ticketUrl?: string;
};

export function renderTournamentScheduleEmail(payload: TournamentEmailPayload) {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="color:#111827;">Horário do torneio – ${payload.eventTitle}</h2>
      <p>Segue o plano de jogos/horários:</p>
      <div style="margin:12px 0; padding:12px; background:#f8fafc; border-radius:8px;">
        ${payload.scheduleHtml ?? "<p>Horários brevemente.</p>"}
      </div>
      ${
        payload.ticketUrl
          ? `<p>Podes ver os teus bilhetes aqui: <a href="${payload.ticketUrl}" style="color:#2563eb;font-weight:bold;">Bilhetes</a></p>`
          : ""
      }
    </div>
  `;

  const text = `Horário do torneio – ${payload.eventTitle}

${payload.scheduleText ?? "Horários brevemente."}

${payload.ticketUrl ? `Bilhetes: ${payload.ticketUrl}` : ""}`;

  return {
    subject: `📅 Horário do torneio – ${payload.eventTitle}`,
    html,
    text,
  };
}

export function renderOwnerTransferEmail(payload: OwnerTransferEmailPayload) {
  const expiresLine = payload.expiresAt ? `O pedido expira em ${payload.expiresAt.toLocaleString("pt-PT")}.` : "";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="color:#111827;">Pedido para te tornares OWNER</h2>
      <p><strong>${payload.actorName}</strong> pediu para te passar o papel de OWNER da organização <strong>${payload.organizerName}</strong>.</p>
      <p>Confirmares significa que ficas como OWNER único e os outros Owners passam a Co-owner.</p>
      <p style="margin:16px 0;"><a href="${payload.confirmUrl}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Confirmar transferência</a></p>
      <p style="color:#6b7280; font-size:12px;">${expiresLine || "O pedido expira em breve."}</p>
    </div>
  `;

  const text = `Pedido para te tornares OWNER
${payload.actorName} quer passar a organização "${payload.organizerName}" para ti.
Confirma aqui: ${payload.confirmUrl}
${expiresLine}`;

  return {
    subject: `🚀 Pedido de OWNER – ${payload.organizerName}`,
    html,
    text,
  };
}

export function renderOfficialEmailVerificationEmail(payload: OfficialEmailVerificationPayload) {
  const expiresLine = payload.expiresAt ? `O pedido expira em ${payload.expiresAt.toLocaleString("pt-PT")}.` : "";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="color:#111827;">Verifica o email oficial</h2>
      <p>Queres definir <strong>${payload.pendingEmail}</strong> como email oficial da organização <strong>${payload.organizerName}</strong>.</p>
      <p>Usamos este email para faturação, alertas e pedidos sensíveis.</p>
      <p style="margin:16px 0;"><a href="${payload.confirmUrl}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Confirmar email</a></p>
      <p style="color:#6b7280; font-size:12px;">${expiresLine || "O pedido expira em breve."}</p>
    </div>
  `;

  const text = `Verifica o email oficial – ${payload.organizerName}

Email: ${payload.pendingEmail}
Confirmar: ${payload.confirmUrl}
${expiresLine}`;

  return {
    subject: `📧 Verifica o email oficial – ${payload.organizerName}`,
    html,
    text,
  };
}
