"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import { trackEvent } from "@/lib/analytics";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { CTA_DANGER, CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";

type PromoCodeDto = {
  id: number;
  name?: string | null;
  description?: string | null;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  status?: "ACTIVE" | "INACTIVE" | "EXPIRED";
  maxUses: number | null;
  perUserLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  eventId: number | null;
  promoterUserId?: string | null;
  promoter?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  minCartValueCents?: number | null;
  createdAt: string;
  updatedAt: string;
  redemptionsCount?: number;
  autoApply?: boolean;
  minQuantity?: number | null;
  minTotalCents?: number | null;
};

type ListResponse = {
  ok: boolean;
  viewerRole?: string | null;
  promoCodes: PromoCodeDto[];
  events: { id: number; title: string; slug: string }[];
  promoStats?: {
    promoCodeId: number;
    tickets: number;
    grossCents: number;
    discountCents: number;
    platformFeeCents: number;
    netCents: number;
    usesTotal?: number;
    usersUnique?: number;
  }[];
  error?: string;
};

type MemberLite = {
  userId: string;
  role: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type PromoDetailResponse =
  | {
      ok: true;
      promo: PromoCodeDto & {
        name?: string | null;
        description?: string | null;
        minCartValueCents?: number | null;
      };
      stats: {
        usesTotal: number;
        usersUnique: number;
        tickets: number;
        grossCents: number;
        discountCents: number;
        netCents: number;
        newUsers: number;
        returningUsers: number;
      };
      topEvents: { id: number; title: string; slug: string | null; uses: number }[];
      history: {
        id: number;
        usedAt: string;
        discountCents: number;
        items: number;
        userLabel: string;
        event: { id: number; title: string; slug: string | null } | null;
      }[];
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SUGGESTED_CODES = [
  { code: "ORYA10", type: "PERCENTAGE" as const, value: "10", hint: "Rede próxima · 10%" },
  { code: "EARLY15", type: "PERCENTAGE" as const, value: "15", hint: "Early bird limitado" },
  { code: "TEAM5", type: "FIXED" as const, value: "5", hint: "5 € por pessoa para grupos" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  code: "",
  type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  value: "10",
  maxUses: "",
  perUserLimit: "",
  validFrom: "",
  validUntil: "",
  eventId: "global",
  promoterUserId: "none",
  active: true,
  autoApply: false,
  minQuantity: "",
  minTotal: "",
  minCart: "",
};

function PromoStatusBadge({ status, active }: { status?: "ACTIVE" | "INACTIVE" | "EXPIRED"; active: boolean }) {
  const finalStatus = status || (active ? "ACTIVE" : "INACTIVE");
  const className =
    finalStatus === "EXPIRED"
      ? "border border-amber-400/40 bg-amber-500/15 text-amber-100"
      : finalStatus === "ACTIVE"
        ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : "border border-white/15 bg-white/10 text-white/70";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] ${className}`}>
      {finalStatus === "EXPIRED" ? "Expirada" : finalStatus === "ACTIVE" ? "Ativo" : "Inativo"}
    </span>
  );
}

export default function PromoCodesClient() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, mutate } = useSWR<ListResponse>(user ? "/api/organizacao/promo" : null, fetcher);
  const viewerRole = data?.viewerRole ?? null;
  const isPromoterOnly = viewerRole === "PROMOTER";
  const { data: membersData } = useSWR<{ ok: boolean; items: MemberLite[] }>(
    user && !isPromoterOnly ? "/api/organizacao/organizations/members" : null,
    fetcher,
  );

  const [filters, setFilters] = useState({
    eventId: "all",
    status: "all" as "all" | "active" | "inactive" | "auto",
    q: "",
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PromoDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loading = !data;
  useEffect(() => {
    if (!user && !data) {
      openModal({ mode: "login", redirectTo: "/organizacao/promo", showGoogle: true });
    }
  }, [user, data, openModal]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const promos = useMemo(() => data?.promoCodes ?? [], [data]);
  const promoStats = useMemo(() => data?.promoStats ?? [], [data]);
  const promoStatsMap = useMemo(() => new Map(promoStats.map((s) => [s.promoCodeId, s])), [promoStats]);
  const promoters = useMemo(
    () =>
      membersData?.items?.filter((member) => member.role === "PROMOTER") ?? [],
    [membersData?.items],
  );
  const canManagePromos = !isPromoterOnly;
  const showPromoterColumn = canManagePromos;

  const filteredPromos = useMemo(() => {
    return promos.filter((p) => {
      const autoApply = !!p.autoApply;
      if (filters.eventId !== "all" && `${p.eventId ?? "global"}` !== filters.eventId) return false;
      if (filters.status === "active" && !p.active) return false;
      if (filters.status === "inactive" && p.active) return false;
      if (filters.status === "auto" && !autoApply) return false;
      if (filters.q.trim()) {
        const q = filters.q.toLowerCase();
        const haystack = `${p.code} ${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [promos, filters]);

  const handleSubmit = async () => {
    if (isPromoterOnly) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const numericValue = Number(form.value);
      if (form.type === "PERCENTAGE") {
        if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100) {
          setError("Percentagem inválida. Usa 1% a 100%.");
          setSaving(false);
          return;
        }
      } else if (!Number.isFinite(numericValue) || numericValue < 0) {
        setError("Valor inválido. Usa um número igual ou superior a 0.");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        code: form.code.trim(),
        type: form.type,
        value:
          form.type === "PERCENTAGE"
            ? Math.round(numericValue * 100) // guardamos em bps
            : Math.round(numericValue * 100), // euros -> cents
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        eventId: form.eventId === "global" ? null : Number(form.eventId),
        active: form.active,
        autoApply: form.autoApply,
        minQuantity: form.minQuantity ? Number(form.minQuantity) : null,
        minTotalCents: form.minTotal ? Math.round(Number(form.minTotal) * 100) : null,
        minCartValueCents: form.minCart ? Math.round(Number(form.minCart) * 100) : null,
        promoterUserId: form.promoterUserId === "none" ? null : form.promoterUserId,
      };
      const res = await fetch("/api/organizacao/promo", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível guardar o código.");
      } else {
        trackEvent("promo_code_created", {
          scope: payload.eventId ? "event" : "global",
          type: payload.type,
        });
        setSuccess(editingId ? "Código atualizado." : "Código criado com sucesso.");
        setForm({ ...EMPTY_FORM, code: "" });
        setEditingId(null);
        mutate();
      }
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao guardar código.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo: PromoCodeDto) => {
    setEditingId(promo.id);
    setForm({
      name: promo.name ?? "",
      description: promo.description ?? "",
      code: promo.code,
      type: promo.type,
      value: promo.type === "PERCENTAGE" ? String(promo.value / 100) : String(promo.value / 100),
      maxUses: promo.maxUses != null ? String(promo.maxUses) : "",
      perUserLimit: promo.perUserLimit != null ? String(promo.perUserLimit) : "",
      validFrom: promo.validFrom ?? "",
      validUntil: promo.validUntil ?? "",
      eventId: promo.eventId == null ? "global" : String(promo.eventId),
      promoterUserId: promo.promoterUserId ?? "none",
      active: promo.active,
      autoApply: !!promo.autoApply,
      minQuantity: promo.minQuantity != null ? String(promo.minQuantity) : "",
      minTotal: promo.minTotalCents != null ? String(promo.minTotalCents / 100) : "",
      minCart: promo.minCartValueCents != null ? String(promo.minCartValueCents / 100) : "",
    });
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch("/api/organizacao/promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || "Erro ao apagar o código.");
      } else {
        trackEvent("promo_code_deleted", { promoId: id });
        if (editingId === id) setEditingId(null);
        mutate();
      }
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao apagar código.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await fetch("/api/organizacao/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      trackEvent(active ? "promo_code_activated" : "promo_code_deactivated", { promoId: id });
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = async (promoId: number) => {
    setDetailId(promoId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/organizacao/promo/${promoId}`);
      const json: PromoDetailResponse = await res.json();
      if (!res.ok || json.ok === false) {
        setDetailError(json && "error" in json ? json.error || "Erro ao carregar detalhe." : "Erro ao carregar detalhe.");
      } else {
        setDetail(json);
      }
    } catch (err) {
      console.error(err);
      setDetailError("Erro ao carregar detalhe.");
    } finally {
      setDetailLoading(false);
    }
  };

  const emptyState = filteredPromos.length === 0 && !loading;

  const stats = useMemo(() => {
    const total = promos.length;
    const active = promos.filter((p) => p.active).length;
    const redemptions = promos.reduce((acc, p) => acc + (p.redemptionsCount ?? 0), 0);
    const totalDiscount = promoStats.reduce((acc, s) => acc + (s.discountCents ?? 0), 0);
    const totalGross = promoStats.reduce((acc, s) => acc + (s.grossCents ?? 0), 0);
    const usersUnique = promoStats.reduce((acc, s) => acc + (s.usersUnique ?? 0), 0);
    return { total, active, redemptions, totalDiscount, totalGross, usersUnique };
  }, [promos, promoStats]);

  const formatEuro = (cents: number) => `${(cents / 100).toFixed(2)} €`;
  const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-PT");
  const statsFor = (promoId: number) =>
    promoStatsMap.get(promoId) ?? { tickets: 0, grossCents: 0, discountCents: 0, netCents: 0, usesTotal: 0, usersUnique: 0 };

  const previewPrice = 20; // € exemplo
  const preview = useMemo(() => {
    const valueNum = Number(form.value) || 0;
    const baseCents = Math.max(0, Math.round(previewPrice * 100));
    const discountCents =
      form.type === "PERCENTAGE"
        ? Math.min(baseCents, Math.round((baseCents * Math.min(100, Math.max(0, valueNum))) / 100))
        : Math.min(baseCents, Math.round(valueNum * 100));
    const totalCents = Math.max(0, baseCents - discountCents);
    return {
      base: baseCents / 100,
      discount: discountCents / 100,
      total: totalCents / 100,
    };
  }, [form.type, form.value]);

  const selectedEventLabel = useMemo(() => {
    if (form.eventId === "global") return "Global";
    return events.find((ev) => String(ev.id) === form.eventId)?.title ?? "Evento";
  }, [form.eventId, events]);

  const valueDisplay =
    form.value !== ""
      ? form.type === "PERCENTAGE"
        ? `${form.value}%`
        : `${form.value} €`
      : "—";
  const validityLabel =
    form.validFrom || form.validUntil
      ? `${form.validFrom ? form.validFrom.replace("T", " ") : "Sem início"} a ${
          form.validUntil ? form.validUntil.replace("T", " ") : "Sem fim"
        }`
      : "Sem validade";
  const limitSummary = useMemo(() => {
    const parts: string[] = [];
    if (form.maxUses !== "") parts.push(`Max ${form.maxUses} usos`);
    if (form.perUserLimit !== "") parts.push(`Por pessoa ${form.perUserLimit}`);
    if (form.minQuantity !== "") parts.push(`Min qtd ${form.minQuantity}`);
    if (form.minTotal !== "") parts.push(`Min total ${form.minTotal} €`);
    if (form.minCart !== "") parts.push(`Min carrinho ${form.minCart} €`);
    return parts.length ? parts.join(" · ") : "Sem limites";
  }, [form.maxUses, form.perUserLimit, form.minQuantity, form.minTotal, form.minCart]);

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10";
  const labelBase = "space-y-1 text-sm text-white/80";
  const helperText = "text-[11px] text-white/55";
  const sectionCard = "rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_34px_rgba(0,0,0,0.28)]";
  const typeToggleBase = "flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition";
  const typeToggleActive = "bg-white/20 text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]";
  const typeToggleInactive = "text-white/60 hover:text-white hover:bg-white/5";

  const applySuggestion = (code: string, type: "PERCENTAGE" | "FIXED", value: string) => {
    setForm((prev) => ({ ...prev, code, type, value }));
  };

  return (
    <section className={cn("w-full py-8 space-y-6 text-white")}>
      <header className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Marketing</p>
        <h1 className="text-2xl font-semibold">Códigos promocionais</h1>
        <p className="text-sm text-white/70">
          Cria códigos de desconto por evento ou globais. Podes ativar/desativar ou definir auto-aplicação a qualquer momento.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-4">
        {loading
          ? [...Array(3)].map((_, idx) => (
              <div key={idx} className="animate-pulse space-y-2">
                <div className="h-3 w-24 rounded bg-white/15" />
                <div className="h-6 w-20 rounded bg-white/20" />
              </div>
            ))
          : (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Ativos</p>
                <p className="text-2xl font-semibold">{stats.active}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Utilizações</p>
                <p className="text-2xl font-semibold">{stats.redemptions}</p>
                <p className="text-[11px] text-white/50">Conta bilhetes (sale_lines)</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Desconto total</p>
                <p className="text-2xl font-semibold">{formatEuro(stats.totalDiscount)}</p>
                <p className="text-[11px] text-white/50">Bruto promo: {formatEuro(stats.totalGross)}</p>
                <p className="text-[11px] text-white/50">Users únicos: {stats.usersUnique}</p>
              </div>
            </>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
          Evento:
          <select
            value={filters.eventId}
            onChange={(e) => setFilters((p) => ({ ...p, eventId: e.target.value }))}
            className="bg-transparent outline-none"
          >
            <option value="all">Todos</option>
            <option value="global">Globais</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
          Estado:
          <select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as typeof filters.status }))}
            className="bg-transparent outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="auto">Auto-aplicados</option>
          </select>
          </label>
        <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1">
          Pesquisa:
          <input
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            className="bg-transparent outline-none placeholder:text-white/40"
            placeholder="Nome ou código"
          />
        </label>
        </div>

        {canManagePromos && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="text-white/80 font-semibold">Sugestões de códigos</p>
              <span className="text-[11px] text-white/60">1 clique</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_CODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => applySuggestion(item.code, item.type, item.value)}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
                >
                  <span className="font-semibold">{item.code}</span>
                  <span className="text-white/60">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-auto rounded-xl border border-white/10">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-white/15" />
                    <div className="h-3 w-32 rounded bg-white/10" />
                  </div>
                  <div className="h-7 w-20 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          ) : emptyState ? (
            <div className="flex flex-col gap-3 p-5 text-white">
              <div>
                <p className="text-lg font-semibold">
                  {canManagePromos ? "Ainda sem códigos promocionais." : "Ainda não tens códigos atribuídos."}
                </p>
                <p className="text-sm text-white/70">
                  {canManagePromos ? "Cria o primeiro." : "Pede à organização para atribuir um código."}
                </p>
              </div>
              {canManagePromos && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document?.getElementById("promo-form");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
                  >
                    Criar primeiro código
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_CODES.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => applySuggestion(item.code, item.type, item.value)}
                        className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
                      >
                        {item.code} · {item.hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <table className="min-w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-[12px] uppercase tracking-[0.12em] text-white/60">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Nome</th>
                  {showPromoterColumn && <th className="px-3 py-2">Promoter</th>}
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Usos</th>
                  <th className="px-3 py-2">Utilizadores</th>
                  <th className="px-3 py-2">Bilhetes</th>
                  <th className="px-3 py-2">Bruto</th>
                  <th className="px-3 py-2">Desconto</th>
                  <th className="px-3 py-2">Líquido</th>
                  <th className="px-3 py-2">Estado</th>
                  {canManagePromos && <th className="px-3 py-2 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPromos.map((promo) => {
                  const s = statsFor(promo.id);
                  return (
                    <tr key={promo.id} className="border-t border-white/10">
                      <td className="px-3 py-2 font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{promo.code}</span>
                          {promo.autoApply && (
                            <span className="mt-1 inline-flex w-fit rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-100">
                              Auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-white/80">{promo.name ?? "—"}</td>
                      {showPromoterColumn && (
                        <td className="px-3 py-2 text-white/70">
                          {promo.promoter?.fullName || promo.promoter?.username || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {promo.eventId == null
                          ? "Global"
                          : events.find((ev) => ev.id === promo.eventId)?.title || "Evento removido"}
                      </td>
                      <td className="px-3 py-2">
                        {promo.type === "PERCENTAGE"
                          ? `${(promo.value / 100).toFixed(2).replace(/\\.00$/, "")}%`
                          : `${(promo.value / 100).toFixed(2).replace(/\\.00$/, "")} €`}
                      </td>
                      <td className="px-3 py-2">{s.usesTotal ?? promo.redemptionsCount ?? 0}</td>
                      <td className="px-3 py-2">{s.usersUnique ?? 0}</td>
                      <td className="px-3 py-2">
                        {s.tickets}
                      </td>
                      <td className="px-3 py-2">
                        {formatEuro(s.grossCents ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-emerald-200">
                        -{formatEuro(s.discountCents ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        {formatEuro(s.netCents ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        <PromoStatusBadge status={promo.status} active={promo.active} />
                      </td>
                      {canManagePromos && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(promo.id)}
                              className={`${CTA_SECONDARY} px-3 py-1 text-[11px]`}
                            >
                              Ver detalhe
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(promo)}
                              className={`${CTA_SECONDARY} px-3 py-1 text-[11px]`}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggle(promo.id, !promo.active)}
                              className={`${CTA_SECONDARY} px-3 py-1 text-[11px]`}
                            >
                              {promo.active ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(promo.id)}
                              className={`${CTA_DANGER} px-3 py-1 text-[11px]`}
                            >
                              Apagar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <ConfirmDestructiveActionDialog
          open={deleteId !== null}
          title="Apagar código promocional?"
          description="Desativa o código e bloqueia novas utilizações. O histórico mantém-se."
          consequences={[
            "Deixa de aplicar no checkout.",
            "Histórico mantido.",
          ]}
          confirmLabel="Apagar código"
          cancelLabel="Cancelar"
          dangerLevel="high"
          onClose={() => setDeleteId(null)}
          onConfirm={() => {
            if (deleteId !== null) handleDelete(deleteId);
          }}
        />

        {canManagePromos && (
          <div
            id="promo-form"
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] space-y-5"
          >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Criar promo</p>
              <h2 className="text-xl font-semibold text-white">Criar / editar</h2>
              <p className="text-sm text-white/65">
                Define desconto, validade e regras. Confirma no resumo.
              </p>
            </div>
            {editingId !== null && (
              <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-100">
                A editar
              </span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className={sectionCard}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Identidade</h3>
                  <span className="text-[11px] text-white/50">Interno</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelBase}>
                    <span>Nome interno</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: Early bird maio"
                    />
                    <span className={helperText}>Só para ti.</span>
                  </label>
                  <label className={labelBase}>
                    <span>Descrição (opcional)</span>
                    <input
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className={inputBase}
                      placeholder="Notas internas ou condições"
                    />
                    <span className={helperText}>Notas curtas.</span>
                  </label>
                  <label className={`${labelBase} sm:col-span-2`}>
                    <span>Código</span>
                    <input
                      value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className={`${inputBase} font-semibold uppercase tracking-[0.2em]`}
                      placeholder="ORYA10"
                    />
                    <span className={helperText}>Sem espaços.</span>
                  </label>
                  {promoters.length > 0 && (
                    <label className={labelBase}>
                      <span>Promoter</span>
                      <select
                        value={form.promoterUserId}
                        onChange={(e) => setForm((p) => ({ ...p, promoterUserId: e.target.value }))}
                        className={inputBase}
                      >
                        <option value="none">Sem promoter</option>
                        {promoters.map((promoter) => (
                          <option key={promoter.userId} value={promoter.userId}>
                            {promoter.fullName || promoter.username || "Promoter"}
                          </option>
                        ))}
                      </select>
                      <span className={helperText}>Atribui este código ao promoter.</span>
                    </label>
                  )}
                </div>
              </div>

              <div className={sectionCard}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Desconto</h3>
                  <span className="text-[11px] text-white/50">Obrigatório</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className={labelBase}>
                    <span>Tipo</span>
                    <div className="mt-1 flex rounded-xl border border-white/10 bg-black/30 p-1">
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: "PERCENTAGE" }))}
                        className={`${typeToggleBase} ${
                          form.type === "PERCENTAGE" ? typeToggleActive : typeToggleInactive
                        }`}
                        aria-pressed={form.type === "PERCENTAGE"}
                      >
                        Percentagem
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: "FIXED" }))}
                        className={`${typeToggleBase} ${
                          form.type === "FIXED" ? typeToggleActive : typeToggleInactive
                        }`}
                        aria-pressed={form.type === "FIXED"}
                      >
                        Valor fixo
                      </button>
                    </div>
                    <span className={helperText}>Percentagem ou euros.</span>
                  </div>
                  <label className={labelBase}>
                    <span>Valor</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={form.type === "PERCENTAGE" ? 100 : undefined}
                        step="0.01"
                        value={form.value}
                        onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                        className={`${inputBase} pr-12`}
                        placeholder={form.type === "PERCENTAGE" ? "Ex.: 10 = 10%" : "Ex.: 5 = 5 €"}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-[12px] text-white/60">
                        {form.type === "PERCENTAGE" ? "%" : "€"}
                      </span>
                    </div>
                    <span className={helperText}>
                      {form.type === "PERCENTAGE" ? "1%–100%." : "Em euros."}
                    </span>
                  </label>
                </div>
              </div>

              <div className={sectionCard}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Validade e escopo</h3>
                  <span className="text-[11px] text-white/50">Global ou por evento</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={`${labelBase} sm:col-span-2`}>
                    <span>Evento</span>
                    <select
                      value={form.eventId}
                      onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))}
                      className={inputBase}
                    >
                      <option value="global">Global</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title}
                        </option>
                      ))}
                    </select>
                    <span className={helperText}>Global = todos.</span>
                  </label>
                  <label className={labelBase}>
                    <span>Válido de</span>
                    <input
                      type="datetime-local"
                      value={form.validFrom}
                      onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                      className={inputBase}
                    />
                  </label>
                  <label className={labelBase}>
                    <span>Válido até</span>
                    <input
                      type="datetime-local"
                      value={form.validUntil}
                      onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
                      className={inputBase}
                    />
                  </label>
                </div>
              </div>

              <div className={sectionCard}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Regras de uso</h3>
                  <span className="text-[11px] text-white/50">Limites opcionais</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelBase}>
                    <span>Usos máximos</span>
                    <input
                      type="number"
                      min={0}
                      value={form.maxUses}
                      onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: 200 (opcional)"
                    />
                  </label>
                  <label className={labelBase}>
                    <span>Por pessoa</span>
                    <input
                      type="number"
                      min={0}
                      value={form.perUserLimit}
                      onChange={(e) => setForm((p) => ({ ...p, perUserLimit: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: 2 (opcional)"
                    />
                  </label>
                  <label className={labelBase}>
                    <span>Mín. por compra</span>
                    <input
                      type="number"
                      min={0}
                      value={form.minQuantity}
                      onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: 2"
                    />
                  </label>
                  <label className={labelBase}>
                    <span>Mín. total (€)</span>
                    <input
                      type="number"
                      min={0}
                      value={form.minTotal}
                      onChange={(e) => setForm((p) => ({ ...p, minTotal: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: 20"
                    />
                  </label>
                  <label className={labelBase}>
                    <span>Mín. carrinho (€)</span>
                    <input
                      type="number"
                      min={0}
                      value={form.minCart}
                      onChange={(e) => setForm((p) => ({ ...p, minCart: e.target.value }))}
                      className={inputBase}
                      placeholder="Ex.: 30"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-white/55">
                  Mín. carrinho tem prioridade.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className={sectionCard}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Resumo</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Código</span>
                    <span className="font-semibold text-white">{form.code || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Tipo</span>
                    <span className="text-white">
                      {form.type === "PERCENTAGE" ? "Percentagem" : "Valor fixo"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Valor</span>
                    <span className="font-semibold text-white">{valueDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Escopo</span>
                    <span className="text-white">{selectedEventLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Validade</span>
                    <span className="text-right text-white/80">{validityLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Limites</span>
                    <span className="text-right text-white/80">{limitSummary}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Estado</span>
                    <span className={form.active ? "font-semibold text-emerald-200" : "text-white/60"}>
                      {form.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                  <p className="text-white/80">
                    {form.autoApply ? "Auto-aplicar ligado." : "Auto-aplicar desligado."}
                  </p>
                  <p className="text-white/50">Aplica no checkout quando válido.</p>
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 shadow-[0_10px_34px_rgba(0,0,0,0.28)] ${
                  form.active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Estado</h3>
                  <span className={form.active ? "text-[11px] text-emerald-200" : "text-[11px] text-white/50"}>
                    {form.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-white/60">
                  Ativa e escolhe auto-aplicar.
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <span>Ativo</span>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                      className="h-4 w-4 accent-emerald-400"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <span>Auto-aplicar</span>
                    <input
                      type="checkbox"
                      checked={form.autoApply}
                      onChange={(e) => setForm((p) => ({ ...p, autoApply: e.target.checked }))}
                      className="h-4 w-4 accent-sky-300"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-[12px] text-white/80">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Preview</p>
                <p className="mt-2 text-sm">
                  Ex.: {preview.base.toFixed(2)} € → paga{" "}
                  <span className="font-semibold text-white">{preview.total.toFixed(2)} €</span>{" "}
                  (desc. {preview.discount.toFixed(2)} €)
                </p>
              </div>

              {(error || success) && (
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px]">
                  {error && <p className="text-red-300">{error}</p>}
                  {success && <p className="text-emerald-200">{success}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className={`${CTA_PRIMARY} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {saving ? "A guardar..." : editingId ? "Guardar alterações" : "Criar código"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setEditingId(null);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`${CTA_SECONDARY} text-[12px]`}
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailId !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/15 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Promo</p>
                <h3 className="text-xl font-semibold text-white">
                  {detail?.ok ? detail.promo.code : "Detalhe da promoção"}
                </h3>
                {detail?.ok && detail.promo.name && (
                  <p className="text-sm text-white/70">{detail.promo.name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailId(null);
                  setDetail(null);
                  setDetailError(null);
                }}
                className={`${CTA_SECONDARY} text-[12px]`}
              >
                Fechar
              </button>
            </div>

                {detailLoading && <p className="mt-4 text-sm text-white/70">A carregar detalhe...</p>}
                {detailError && (
                  <p className="mt-4 text-sm text-red-300">
                    {detailError || "Não foi possível carregar o detalhe."}
                  </p>
                )}

                {detail?.ok && (
                  <div className="mt-4 space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Utilizações</p>
                        <p className="text-lg font-semibold text-white">{detail.stats.usesTotal}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Utilizadores únicos</p>
                        <p className="text-lg font-semibold text-white">{detail.stats.usersUnique}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Bilhetes</p>
                        <p className="text-lg font-semibold text-white">{detail.stats.tickets}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Bruto</p>
                        <p className="text-lg font-semibold text-white">{formatEuro(detail.stats.grossCents)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Desconto</p>
                        <p className="text-lg font-semibold text-emerald-200">
                          -{formatEuro(detail.stats.discountCents)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Líquido</p>
                        <p className="text-lg font-semibold text-white">{formatEuro(detail.stats.netCents)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Novos</p>
                        <p className="text-lg font-semibold text-white">{detail.stats.newUsers}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-white/60">Recorrentes</p>
                        <p className="text-lg font-semibold text-white">{detail.stats.returningUsers}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">Top eventos</p>
                          {detail.topEvents.length === 0 && (
                            <span className="text-[12px] text-white/50">Sem utilizações</span>
                          )}
                        </div>
                        <div className="mt-2 space-y-2">
                          {detail.topEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm text-white">{ev.title}</p>
                                {ev.slug && <p className="text-[11px] text-white/50">/{ev.slug}</p>}
                              </div>
                              <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/80">
                                {ev.uses} uso{ev.uses === 1 ? "" : "s"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">Histórico recente</p>
                          <span className="text-[11px] text-white/60">
                            Últimos {detail.history.length} registos
                          </span>
                        </div>
                        <div className="mt-2 space-y-2 max-h-64 overflow-auto pr-1">
                          {detail.history.map((h) => (
                            <div
                              key={h.id}
                              className="rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">{formatEuro(h.discountCents)}</span>
                                <span className="text-white/60">{formatDateTime(h.usedAt)}</span>
                              </div>
                              <p className="text-white/70">Utilizador: {h.userLabel}</p>
                              <p className="text-white/60">
                                Itens: {h.items} · Evento: {h.event?.title ?? "—"}
                              </p>
                            </div>
                          ))}
                          {detail.history.length === 0 && (
                            <p className="text-[12px] text-white/60">Sem histórico registado.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
    </section>
  );
}
