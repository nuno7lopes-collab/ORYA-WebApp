"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CourtCategory = {
  id: number;
  slug: string;
  label: string;
  domain: "COURT";
  isActive?: boolean;
};

type CourtService = {
  id: number;
  title: string;
  category?: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
};

type CourtConfig = {
  id: number;
  courtId: number;
  backingServiceId: number;
  categoryId: number | null;
  displayName: string;
  displayDescription: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  category?: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
  backingService?: {
    id: number;
    title: string;
    kind: string;
    isActive?: boolean;
  } | null;
};

type CourtConfigItem = {
  court: {
    id: number;
    name: string;
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    club: { id: number; name: string };
  };
  config: CourtConfig | null;
  status: "READY" | "INACTIVE" | "MISSING_CONFIG";
};

type CourtConfigResponse = {
  ok: boolean;
  items: CourtConfigItem[];
  categories: CourtCategory[];
  courtServices: CourtService[];
};

type CourtDraft = {
  backingServiceId: string;
  categoryId: string;
  displayName: string;
  displayDescription: string;
  coverImageUrl: string;
  isActive: boolean;
};

function toDraft(item: CourtConfigItem): CourtDraft {
  return {
    backingServiceId: item.config?.backingServiceId ? String(item.config.backingServiceId) : "",
    categoryId: item.config?.categoryId ? String(item.config.categoryId) : "",
    displayName: item.config?.displayName ?? item.court.name,
    displayDescription: item.config?.displayDescription ?? item.court.description ?? "",
    coverImageUrl: item.config?.coverImageUrl ?? "",
    isActive: item.config?.isActive ?? true,
  };
}

export default function ReservasCamposPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;
  const configApiPath = resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/campos/config");

  const { data, isLoading, mutate } = useSWR<CourtConfigResponse>(configApiPath, fetcher);
  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const courtServices = data?.courtServices ?? [];
  const [drafts, setDrafts] = useState<Record<number, CourtDraft>>({});
  const [savingCourtId, setSavingCourtId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const rows = useMemo(() => {
    return items.map((item) => ({
      ...item,
      draft: drafts[item.court.id] ?? toDraft(item),
    }));
  }, [drafts, items]);

  const setDraft = (courtId: number, patch: Partial<CourtDraft>) => {
    setDrafts((prev) => {
      const existingItem = items.find((item) => item.court.id === courtId);
      const base = prev[courtId] ?? (existingItem ? toDraft(existingItem) : null);
      if (!base) return prev;
      return {
        ...prev,
        [courtId]: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const saveCourtConfig = async (item: CourtConfigItem, draft: CourtDraft) => {
    if (!configApiPath) return;
    const backingServiceId = draft.backingServiceId ? Number(draft.backingServiceId) : null;
    if (backingServiceId != null && !Number.isFinite(backingServiceId)) {
      setFeedback("Seleciona um serviço de base válido.");
      return;
    }
    const categoryId = draft.categoryId ? Number(draft.categoryId) : null;
    if (categoryId != null && !Number.isFinite(categoryId)) {
      setFeedback("Seleciona uma categoria válida.");
      return;
    }
    setFeedback(null);
    setSavingCourtId(item.court.id);
    try {
      const res = await fetch(configApiPath, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courtId: item.court.id,
          backingServiceId,
          categoryId,
          displayName: draft.displayName,
          displayDescription: draft.displayDescription || null,
          coverImageUrl: draft.coverImageUrl || null,
          isActive: draft.isActive,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            result?: { ok?: boolean; error?: string; message?: string };
          }
        | null;
      const success = json?.ok ?? json?.result?.ok ?? false;
      if (!res.ok || !success) {
        const error =
          json?.result?.error ??
          json?.result?.message ??
          json?.error ??
          "Erro ao guardar configuração do campo.";
        setFeedback(error);
        return;
      }
      setFeedback("Configuração guardada.");
      await mutate();
    } catch {
      setFeedback("Erro de rede ao guardar configuração.");
    } finally {
      setSavingCourtId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className="text-xl font-semibold text-white">Campos</h1>
          <p className={DASHBOARD_MUTED}>Mapeamento de campo para serviço base COURT, categoria e visibilidade pública.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={appendOrganizationIdToHref("/org/bookings/classes", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Aulas
          </Link>
          <Link href={appendOrganizationIdToHref("/org/bookings", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Serviços
          </Link>
          <Link href={appendOrganizationIdToHref("/org/bookings/new", canonicalOrganizationId)} className={CTA_PRIMARY}>
            Novo serviço COURT
          </Link>
        </div>
      </header>

      {feedback ? (
        <div className="rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-[12px] text-white/85">{feedback}</div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        {isLoading && <p className="text-[12px] text-white/60">A carregar configuração dos campos...</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-[12px] text-white/50">Sem campos configurados para esta organização.</p>
        )}

        <div className="space-y-3">
          {rows.map((item) => {
            const draft = item.draft;
            return (
              <article key={item.court.id} className="rounded-2xl border border-white/12 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.court.name}</p>
                    <p className="text-[11px] text-white/60">Clube {item.court.club.name}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px]",
                      item.status === "READY"
                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                        : item.status === "INACTIVE"
                          ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                          : "border-rose-300/40 bg-rose-400/10 text-rose-100",
                    )}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-white/65">Serviço base COURT</span>
                    <select
                      value={draft.backingServiceId}
                      onChange={(event) => setDraft(item.court.id, { backingServiceId: event.target.value })}
                      className="w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                    >
                      <option value="">Selecionar serviço</option>
                      {courtServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-white/65">Categoria COURT</span>
                    <select
                      value={draft.categoryId}
                      onChange={(event) => setDraft(item.court.id, { categoryId: event.target.value })}
                      className="w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-white/65">Nome público</span>
                    <input
                      value={draft.displayName}
                      onChange={(event) => setDraft(item.court.id, { displayName: event.target.value })}
                      className="w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] text-white/65">Imagem capa (URL)</span>
                    <input
                      value={draft.coverImageUrl}
                      onChange={(event) => setDraft(item.court.id, { coverImageUrl: event.target.value })}
                      className="w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                    />
                  </label>
                </div>

                <label className="mt-3 block space-y-1">
                  <span className="text-[11px] text-white/65">Descrição pública</span>
                  <textarea
                    value={draft.displayDescription}
                    onChange={(event) => setDraft(item.court.id, { displayDescription: event.target.value })}
                    className="min-h-[76px] w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-[12px] text-white/80">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) => setDraft(item.court.id, { isActive: event.target.checked })}
                    />
                    Campo visível para reservas
                  </label>
                  <button
                    type="button"
                    className={CTA_PRIMARY}
                    disabled={savingCourtId === item.court.id}
                    onClick={() => saveCourtConfig(item, draft)}
                  >
                    {savingCourtId === item.court.id ? "A guardar..." : "Guardar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
