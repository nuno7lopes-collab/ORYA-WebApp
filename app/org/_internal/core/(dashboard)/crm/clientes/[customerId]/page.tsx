"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CONSENT_LABELS = {
  MARKETING: "Marketing",
  CONTACT_EMAIL: "Email de contacto",
  CONTACT_SMS: "SMS de contacto",
} as const;

const CONSENT_STATUS_LABELS: Record<string, string> = {
  GRANTED: "Concedido",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

type ConsentTypeKey = keyof typeof CONSENT_LABELS;

type ConsentSnapshot = {
  status: string | null;
  source: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string | null;
};

type InteractionRow = {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string | null;
  occurredAt: string;
  amountCents: number | null;
  currency: string | null;
  metadata?: Record<string, unknown> | null;
};

type NoteRow = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null };
};

type CustomerDetailResponse = {
  ok: boolean;
  customer: {
    id: string;
    userId: string | null;
    contactType: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    marketingOptIn: boolean;
    firstInteractionAt: string | null;
    lastActivityAt: string | null;
    lastPurchaseAt: string | null;
    totalSpentCents: number;
    totalOrders: number;
    totalBookings: number;
    totalAttendances: number;
    totalTournaments: number;
    totalStoreOrders: number;
    tags: string[];
    notesCount: number;
    consents: Record<ConsentTypeKey, ConsentSnapshot | null>;
  };
  interactions: InteractionRow[];
  notes: NoteRow[];
};

type CustomerPadelResponse = {
  ok: boolean;
  contactId: string;
  padel: {
    id: string;
    playerProfileId: number | null;
    level: string | null;
    preferredSide: string | null;
    clubName: string | null;
    tournamentsCount: number;
    noShowCount: number;
    lastMatchAt: string | null;
    matches30d: number;
    winRate90d: number;
    noShowRate90d: number;
    preferredTimeBucket: string | null;
    offPeakRatio30d: number;
    reservationCount90d: number;
    lessonCount90d: number;
    tournamentCount90d: number;
    avgSpendPerSessionCents90d: number;
    lastNoShowAt: string | null;
    activityStatus: string | null;
    competitiveTier: string | null;
    rfmScore: number;
    churnRiskScore: number;
    reactivationPropensityScore: number;
    playerProfile: {
      id: number;
      fullName: string | null;
      level: string | null;
      preferredSide: string | null;
      clubName: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type CustomerTimelineResponse = {
  ok: boolean;
  domain: "all" | "padel";
  total: number;
  items: InteractionRow[];
};

type CrmTagOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
};

type CrmTagListResponse = {
  ok: boolean;
  tags?: CrmTagOption[];
  tag?: CrmTagOption;
  error?: string;
  message?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function isPadelInteractionType(value: string) {
  return value.trim().toUpperCase().startsWith("PADEL_");
}

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const customerId = typeof params?.customerId === "string" ? params.customerId : "";
  const { data, isLoading, mutate } = useSWR<CustomerDetailResponse>(
    customerId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes/${customerId}`) : null,
    fetcher,
  );
  const { data: timelineData } = useSWR<CustomerTimelineResponse>(
    customerId
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes/${customerId}/timeline?domain=padel`)
      : null,
    fetcher,
  );
  const { data: padelData } = useSWR<CustomerPadelResponse>(
    customerId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes/${customerId}/padel`) : null,
    fetcher,
  );
  const { data: tagsData, mutate: mutateTags } = useSWR<CrmTagListResponse>(
    customerId ? resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/tags") : null,
    fetcher,
  );

  const customer = data?.customer ?? null;
  const availableTags = useMemo(() => (tagsData?.ok ? tagsData.tags ?? [] : []), [tagsData]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSaving, setTagSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#22D3EE");
  const [newTagSaving, setNewTagSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setSelectedTags(customer.tags);
    }
  }, [customer?.id, customer?.tags]);

  const interactions = useMemo(
    () =>
      timelineData?.items ??
      (data?.interactions ?? []).filter((interaction) => isPadelInteractionType(interaction.type)),
    [data?.interactions, timelineData?.items],
  );
  const notes = useMemo(() => data?.notes ?? [], [data]);
  const padel = padelData?.padel ?? null;

  const handleSaveTags = async () => {
    if (!customer) return;
    setTagSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes/${customer.id}/tags`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: selectedTags }),
      });
      if (!res.ok) throw new Error("Falha ao guardar tags");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar tags");
    } finally {
      setTagSaving(false);
    }
  };

  const toggleTagSelection = (name: string) => {
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((tag) => tag !== name) : [...prev, name]));
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (name.length < 2) {
      setError("Nome da tag inválido (mínimo 2 caracteres).");
      return;
    }
    setNewTagSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      const json = (await res.json().catch(() => null)) as CrmTagListResponse | null;
      if (!res.ok || !json?.ok || !json.tag) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao criar tag");
      }
      const createdTag = json.tag;
      await mutateTags();
      setSelectedTags((prev) => (prev.includes(createdTag.name) ? prev : [...prev, createdTag.name]));
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar tag");
    } finally {
      setNewTagSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!customer || noteBody.trim().length < 2) return;
    setNoteSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes/${customer.id}/notas`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao criar nota");
      setNoteBody("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar nota");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleConsentToggle = async (type: ConsentTypeKey, granted: boolean) => {
    if (!customer) return;
    const key = `${customer.id}:${type}`;
    setConsentSaving((prev) => ({ ...prev, [key]: true }));
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/consentimentos/${customer.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, granted }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar consentimento");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar consentimento");
    } finally {
      setConsentSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Perfil do cliente</h1>
        <p className={DASHBOARD_MUTED}>Dados, histórico e notas internas da organização.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-5")}
      >
        {isLoading && !customer ? (
          <p className="text-[12px] text-white/60">A carregar cliente...</p>
        ) : customer ? (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {customer.displayName || "Cliente sem nome"}
                </p>
                <p className="text-[12px] text-white/60">{customer.contactEmail || customer.contactPhone || "Contacto indisponível"}</p>
                {customer.contactType ? (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {customer.contactType}
                  </p>
                ) : null}
                {customer.bio ? <p className="mt-1 text-[12px] text-white/50">{customer.bio}</p> : null}
              </div>
              <div className="grid gap-2 text-[12px] text-white/70 sm:grid-cols-2">
                <span>Primeira interação: {formatDate(customer.firstInteractionAt)}</span>
                <span>Última atividade: {formatDate(customer.lastActivityAt)}</span>
                <span>Última compra: {formatDate(customer.lastPurchaseAt)}</span>
                <span>Opt-in marketing: {customer.marketingOptIn ? "Sim" : "Não"}</span>
                <span>Gasto total: {formatCurrency(customer.totalSpentCents ?? 0, "EUR")}</span>
                <span>Pagamentos jogo: {customer.totalOrders}</span>
                <span>Reservas: {customer.totalBookings}</span>
                <span>Sessões: {customer.totalAttendances}</span>
                <span>Torneios: {customer.totalTournaments}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[12px] text-white/70">
                Tags do cliente
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isActive = selectedTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTagSelection(tag.name)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] tracking-[0.16em]",
                          isActive
                            ? "border-white/35 bg-white/15 text-white"
                            : "border-white/15 bg-white/5 text-white/70",
                        )}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
                        {tag.name}
                      </button>
                    );
                  })}
                  {!availableTags.length ? (
                    <span className="text-[11px] text-white/50">Sem tags no clube.</span>
                  ) : null}
                </div>
              </div>
              <label className="text-[12px] text-white/70">
                Criar nova tag
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="ex.: Jogador manhã"
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                />
              </label>
              <input
                type="color"
                className="h-[40px] w-full rounded-xl border border-white/15 bg-white/5 px-2"
                value={newTagColor}
                onChange={(event) => setNewTagColor(event.target.value)}
                aria-label="Cor da tag"
              />
              <button
                type="button"
                className={cn(CTA_NEUTRAL, "w-full justify-center")}
                onClick={handleCreateTag}
                disabled={newTagSaving}
              >
                {newTagSaving ? "A criar..." : "Criar tag"}
              </button>
              <button
                type="button"
                className={cn(CTA_NEUTRAL, "w-full justify-center")}
                onClick={handleSaveTags}
                disabled={tagSaving}
              >
                {tagSaving ? "A guardar..." : "Guardar tags"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-white/60">Cliente não encontrado.</p>
        )}
      </section>

      {customer ? (
        <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Consentimentos</h2>
            <span className="text-[11px] text-white/50">Atualiza apenas com consentimento explícito.</span>
          </div>
          <div className="grid gap-2 text-[12px] text-white/80 md:grid-cols-3">
            {(Object.keys(CONSENT_LABELS) as ConsentTypeKey[]).map((type) => {
              const snapshot = customer.consents?.[type] ?? null;
              const status = snapshot?.status ?? null;
              const label = CONSENT_STATUS_LABELS[status ?? ""] ?? "Indefinido";
              const key = `${customer.id}:${type}`;
              const isSaving = Boolean(consentSaving[key]);
              const isGranted = status === "GRANTED";
              return (
                <label
                  key={key}
                  className="flex flex-col gap-1 rounded-xl border border-white/12 bg-white/5 px-3 py-2"
                >
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">{CONSENT_LABELS[type]}</span>
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isGranted}
                      onChange={(event) => handleConsentToggle(type, event.target.checked)}
                      disabled={isSaving}
                      className="h-3 w-3 accent-[#22D3EE]"
                    />
                    <span className="text-[12px] text-white/80">{label}</span>
                    {isSaving ? <span className="text-[11px] text-white/45">A guardar...</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {customer ? (
        <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Ficha 360 Padel</h2>
            <span className="text-[11px] text-white/50">{padel ? "Projeção ativa" : "Sem perfil padel"}</span>
          </div>
          {padel ? (
            <div className="grid gap-2 text-[12px] text-white/75 md:grid-cols-3">
              <span>Ligação a perfil jogador: {padel.playerProfile ? "Ligado" : "Não ligado"}</span>
              <span>Jogador: {padel.playerProfile?.fullName ?? "—"}</span>
              <span>Estado: {padel.activityStatus ?? "—"}</span>
              <span>Tier: {padel.competitiveTier ?? "—"}</span>
              <span>RFM: {padel.rfmScore}</span>
              <span>Risco churn: {padel.churnRiskScore}</span>
              <span>Propensão reativação: {padel.reactivationPropensityScore}</span>
              <span>Último jogo: {formatDate(padel.lastMatchAt)}</span>
              <span>Último no-show: {formatDate(padel.lastNoShowAt)}</span>
              <span>Jogos 30d: {padel.matches30d}</span>
              <span>Win rate 90d: {(padel.winRate90d * 100).toFixed(1)}%</span>
              <span>No-show rate 90d: {(padel.noShowRate90d * 100).toFixed(1)}%</span>
              <span>Nível: {padel.level ?? "—"}</span>
              <span>Lado: {padel.preferredSide ?? "—"}</span>
              <span>Janela horária preferida: {padel.preferredTimeBucket ?? "—"}</span>
              <span>Clube: {padel.clubName ?? "—"}</span>
              <span>Rácio off-peak 30d: {(padel.offPeakRatio30d * 100).toFixed(1)}%</span>
              <span>Reservas 90d: {padel.reservationCount90d}</span>
              <span>Aulas 90d: {padel.lessonCount90d}</span>
              <span>Torneios 90d: {padel.tournamentCount90d}</span>
              <span>Gasto médio/sessão 90d: {formatCurrency(padel.avgSpendPerSessionCents90d, "EUR")}</span>
              <span>Torneios: {padel.tournamentsCount}</span>
              <span>No-shows: {padel.noShowCount}</span>
              <span>Projeção criada: {formatDate(padel.createdAt)}</span>
              <span>Atualizado: {formatDate(padel.updatedAt)}</span>
            </div>
          ) : (
            <p className="text-[12px] text-white/55">
              Ainda sem dados de atividade padel suficientes para projeção.
            </p>
          )}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Timeline</h2>
            <div className="flex items-center gap-2">
              <span className={cn(CTA_NEUTRAL, "border-white/30")}>
                Padel
              </span>
              <span className="text-[11px] text-white/50">{interactions.length} interações</span>
            </div>
          </div>
          <div className="space-y-2">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-white">{interaction.type}</p>
                    <p className="text-[11px] text-white/50">{interaction.sourceType}</p>
                  </div>
                  <div className="text-right text-[11px] text-white/50">
                    <p>{formatDate(interaction.occurredAt)}</p>
                    {interaction.amountCents !== null ? (
                      <p className="text-white/80">
                        {formatCurrency(interaction.amountCents, interaction.currency || "EUR")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {interactions.length === 0 && !isLoading ? (
              <p className="text-[12px] text-white/50">Sem interações registadas.</p>
            ) : null}
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Notas internas</h2>
            <span className="text-[11px] text-white/50">{notes.length} notas</span>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[12px] text-white/80">{note.body}</p>
                <p className="mt-1 text-[11px] text-white/40">
                  {note.author.fullName || note.author.username || "Equipa"} · {formatDate(note.createdAt)}
                </p>
              </div>
            ))}
            {notes.length === 0 && !isLoading ? (
              <p className="text-[12px] text-white/50">Sem notas internas.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Adicionar nota interna"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
            <button
              type="button"
              className={cn(CTA_PRIMARY, "w-full justify-center")}
              onClick={handleAddNote}
              disabled={noteSaving}
            >
              {noteSaving ? "A guardar..." : "Guardar nota"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
