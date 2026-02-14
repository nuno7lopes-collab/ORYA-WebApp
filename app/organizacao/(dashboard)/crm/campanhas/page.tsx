"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  approvalState?: string;
  channel: string;
  channels?: string[];
  channelsConfig?: { inApp: boolean; email: boolean };
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  segment: { id: string; name: string } | null;
};

type CampaignListResponse = {
  ok: boolean;
  items: CampaignRow[];
  errorCode?: string;
  message?: string;
};

type SegmentRow = {
  id: string;
  name: string;
};

type SegmentListResponse = {
  ok: boolean;
  items: SegmentRow[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function CrmCampanhasPage() {
  const { data, isLoading, mutate } = useSWR<CampaignListResponse>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/campanhas"),
    fetcher,
  );
  const { data: segmentsData } = useSWR<SegmentListResponse>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/segmentos"),
    fetcher,
  );
  const segments = segmentsData?.items ?? [];
  const campaigns = data?.items ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segmentId, setSegmentId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasChannel = channelInApp || channelEmail;
  const canSubmit = useMemo(
    () => name.trim().length >= 2 && Boolean(segmentId) && hasChannel,
    [name, segmentId, hasChannel],
  );

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      let scheduledAtValue: string | null = null;
      if (scheduledAt.trim()) {
        const parsed = new Date(scheduledAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("Data invalida.");
        }
        scheduledAtValue = parsed.toISOString();
      }
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        segmentId: segmentId || null,
        channel: "IN_APP",
        channels: { inApp: channelInApp, email: channelEmail },
        scheduledAt: scheduledAtValue,
        payload: {
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          emailSubject: emailSubject.trim() || undefined,
          channels: { inApp: channelInApp, email: channelEmail },
        },
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/campanhas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao criar campanha");
      setName("");
      setDescription("");
      setSegmentId("");
      setTitle("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      setScheduledAt("");
      setChannelInApp(true);
      setChannelEmail(false);
      setEmailSubject("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (campaignId: string) => {
    setSendingId(campaignId);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/campanhas/${campaignId}/enviar`), {
        method: "POST",
      });
      if (!res.ok) throw new Error("Falha ao enviar campanha");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar campanha");
    } finally {
      setSendingId(null);
    }
  };

  const handleCampaignAction = async (
    campaignId: string,
    action: "submit" | "approve" | "reject" | "cancel",
    body?: Record<string, unknown>,
  ) => {
    setActioningId(campaignId);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/campanhas/${campaignId}/${action}`), {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha na ação da campanha");
      }
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar ação");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Campanhas</h1>
        <p className={DASHBOARD_MUTED}>Envios in-app e email com segmentação e métricas básicas.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}
      >
        <h2 className="text-sm font-semibold text-white">Nova campanha</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome da campanha
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Segmento
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={segmentId}
              onChange={(event) => setSegmentId(event.target.value)}
            >
              <option value="">Selecionar segmento</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-white/45">Obrigatório para envios no MVP.</span>
          </label>
          <div className="rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] text-white/70 md:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Canais</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-[12px] text-white/75">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-white"
                  checked={channelInApp}
                  onChange={(event) => setChannelInApp(event.target.checked)}
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/75">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-white"
                  checked={channelEmail}
                  onChange={(event) => setChannelEmail(event.target.checked)}
                />
                Email
              </label>
              {!hasChannel ? (
                <span className="text-[11px] text-rose-200">Seleciona pelo menos um canal.</span>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] text-white/45">Respeita consentimento de marketing e preferências.</p>
          </div>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Descrição
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Título
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            CTA label
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={ctaLabel}
              onChange={(event) => setCtaLabel(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Mensagem
            <textarea
              className="mt-1 min-h-[96px] w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            CTA URL
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={ctaUrl}
              onChange={(event) => setCtaUrl(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70 md:col-span-2">
            Agendar envio (opcional)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <span className="mt-1 block text-[10px] text-white/45">Se vazio, fica em rascunho.</span>
          </label>
          {channelEmail ? (
            <label className="text-[12px] text-white/70 md:col-span-2">
              Assunto do email (opcional)
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={emailSubject}
                onChange={(event) => setEmailSubject(event.target.value)}
              />
              <span className="mt-1 block text-[10px] text-white/45">Se vazio, usa o título.</span>
            </label>
          ) : null}
        </div>
        <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={!canSubmit || saving}>
          {saving ? "A guardar..." : "Criar campanha"}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Campanhas</h2>
          <span className="text-[11px] text-white/50">{campaigns.length} campanhas</span>
        </div>
        <div className="grid gap-3">
          {campaigns.map((campaign) => {
            const canSend =
              ["DRAFT", "PAUSED", "SCHEDULED"].includes(campaign.status) &&
              (campaign.approvalState ?? "DRAFT") === "APPROVED";
            return (
              <div key={campaign.id} className={cn(DASHBOARD_CARD, "p-4")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{campaign.name}</p>
                    <p className="text-[12px] text-white/60">{campaign.description || "Sem descrição"}</p>
                    <p className="text-[11px] text-white/45">Segmento: {campaign.segment?.name || "Manual"}</p>
                    <p className="text-[11px] text-white/45">Canais: {campaign.channels?.join(" + ") || campaign.channel}</p>
                  </div>
                  <div className="text-right text-[11px] text-white/60">
                    <p>Status: {campaign.status}</p>
                    <p>Aprovação: {campaign.approvalState ?? "DRAFT"}</p>
                    <p>Enviado: {formatDate(campaign.sentAt)}</p>
                    <p>Agendado: {formatDate(campaign.scheduledAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-white/70">
                  <span>Enviados: {campaign.sentCount}</span>
                  <span>Abertos: {campaign.openedCount}</span>
                  <span>Cliques: {campaign.clickedCount}</span>
                  <span>Falhas: {campaign.failedCount}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["DRAFT", "REJECTED"].includes(campaign.approvalState ?? "DRAFT") &&
                  !["SENT", "SENDING", "CANCELLED"].includes(campaign.status) ? (
                    <button
                      type="button"
                      className={CTA_NEUTRAL}
                      onClick={() => handleCampaignAction(campaign.id, "submit")}
                      disabled={actioningId === campaign.id}
                    >
                      {actioningId === campaign.id ? "A submeter..." : "Submeter aprovação"}
                    </button>
                  ) : null}
                  {(campaign.approvalState ?? "") === "SUBMITTED" ? (
                    <>
                      <button
                        type="button"
                        className={CTA_NEUTRAL}
                        onClick={() => handleCampaignAction(campaign.id, "approve")}
                        disabled={actioningId === campaign.id}
                      >
                        {actioningId === campaign.id ? "A aprovar..." : "Aprovar"}
                      </button>
                      <button
                        type="button"
                        className={CTA_NEUTRAL}
                        onClick={() => handleCampaignAction(campaign.id, "reject")}
                        disabled={actioningId === campaign.id}
                      >
                        {actioningId === campaign.id ? "A rejeitar..." : "Rejeitar"}
                      </button>
                    </>
                  ) : null}
                  {!["SENT", "SENDING", "CANCELLED"].includes(campaign.status) ? (
                    <button
                      type="button"
                      className={CTA_NEUTRAL}
                      onClick={() => handleCampaignAction(campaign.id, "cancel")}
                      disabled={actioningId === campaign.id}
                    >
                      {actioningId === campaign.id ? "A cancelar..." : "Cancelar"}
                    </button>
                  ) : null}
                  {canSend ? (
                    <button
                      type="button"
                      className={CTA_NEUTRAL}
                      onClick={() => handleSend(campaign.id)}
                      disabled={sendingId === campaign.id}
                    >
                      {sendingId === campaign.id ? "A enviar..." : "Enviar agora"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!isLoading && campaigns.length === 0 ? (
            <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>Sem campanhas criadas.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
