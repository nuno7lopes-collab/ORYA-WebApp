"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { getEventCoverUrl } from "@/lib/eventCover";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

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
  resourceId: number | null;
  availabilityScopeId: number | null;
  hasResourceLinked: boolean;
  hasResourceSpecificAvailability: boolean;
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

function resolveStatusMeta(status: CourtConfigItem["status"]) {
  if (status === "READY") {
    return {
      label: "Configurado",
      tone: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    };
  }
  if (status === "INACTIVE") {
    return {
      label: "Inativo",
      tone: "border-amber-300/40 bg-amber-400/10 text-amber-100",
    };
  }
  return {
    label: "Por configurar",
    tone: "border-rose-300/40 bg-rose-400/10 text-rose-100",
  };
}

function resolveAvailabilityMeta(item: CourtConfigItem) {
  if (!item.hasResourceLinked) {
    return {
      label: "Sem recurso",
      tone: "border-rose-300/40 bg-rose-400/10 text-rose-100",
    };
  }
  if (item.hasResourceSpecificAvailability) {
    return {
      label: "Tem disponibilidade própria",
      tone: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    };
  }
  return {
    label: "Usa disponibilidade geral",
    tone: "border-sky-300/40 bg-sky-400/10 text-sky-100",
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
  const [uploadingCourtId, setUploadingCourtId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cropContext, setCropContext] = useState<{ courtId: number; file: File } | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  const uploadCoverFile = async (courtId: number, file: File) => {
    if (!canonicalOrganizationId) {
      setFeedback("Organização inválida para upload.");
      return;
    }
    setUploadingCourtId(courtId);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/upload?scope=service-cover&organizationId=${canonicalOrganizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setDraft(courtId, { coverImageUrl: String(json.url) });
      setFeedback("Fotografia carregada. Guarda para aplicar ao campo.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Não foi possível carregar a fotografia.");
    } finally {
      setUploadingCourtId(null);
    }
  };

  const saveCourtConfig = async (item: CourtConfigItem, draft: CourtDraft) => {
    if (!configApiPath) return;
    const backingServiceId = draft.backingServiceId ? Number(draft.backingServiceId) : null;
    if (backingServiceId != null && !Number.isFinite(backingServiceId)) {
      setFeedback("Seleciona uma base de campo válida.");
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
    <>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className={DASHBOARD_LABEL}>Academia</p>
            <h1 className="text-xl font-semibold text-white">Campos</h1>
            <p className={DASHBOARD_MUTED}>
              Mapeamento de campo para base COURT, fotografia e disponibilidade por recurso.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={appendOrganizationIdToHref("/org/bookings", canonicalOrganizationId)} className={CTA_SECONDARY}>
              Aulas
            </Link>
            <Link href={appendOrganizationIdToHref("/org/bookings/professionals", canonicalOrganizationId)} className={CTA_SECONDARY}>
              Treinadores
            </Link>
            <Link href={appendOrganizationIdToHref("/org/bookings/new?kind=COURT", canonicalOrganizationId)} className={CTA_PRIMARY}>
              Novo campo
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
              const statusMeta = resolveStatusMeta(item.status);
              const availabilityMeta = resolveAvailabilityMeta(item);
              const coverPreview = draft.coverImageUrl
                ? getEventCoverUrl(draft.coverImageUrl, {
                    seed: `court-${item.court.id}`,
                    width: 520,
                    quality: 72,
                    square: true,
                  })
                : null;
              const availabilityHref =
                item.resourceId != null
                  ? appendOrganizationIdToHref(
                      `/org/calendar/availability?scopeType=RESOURCE&scopeId=${item.resourceId}`,
                      canonicalOrganizationId,
                    )
                  : null;

              return (
                <article key={item.court.id} className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.court.name}</p>
                      <p className="text-[11px] text-white/60">Clube {item.court.club.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px]",
                          availabilityMeta.tone,
                        )}
                      >
                        {availabilityMeta.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px]",
                          statusMeta.tone,
                        )}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-white/65">Base COURT</span>
                      <select
                        value={draft.backingServiceId}
                        onChange={(event) => setDraft(item.court.id, { backingServiceId: event.target.value })}
                        className="w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                      >
                        <option value="">Selecionar base</option>
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

                    <div className="space-y-1">
                      <span className="text-[11px] text-white/65">Fotografia do campo</span>
                      <div className="flex items-start gap-3">
                        <div className="h-20 w-20 overflow-hidden rounded-xl border border-white/12 bg-white/8">
                          {coverPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverPreview} alt={`Campo ${draft.displayName || item.court.name}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">Sem foto</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input
                            ref={(node) => {
                              fileInputRefs.current[item.court.id] = node;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              event.target.value = "";
                              if (!file) return;
                              setCropContext({ courtId: item.court.id, file });
                            }}
                          />
                          <button
                            type="button"
                            className={CTA_SECONDARY}
                            onClick={() => fileInputRefs.current[item.court.id]?.click()}
                            disabled={uploadingCourtId === item.court.id}
                          >
                            {uploadingCourtId === item.court.id
                              ? "A carregar..."
                              : draft.coverImageUrl
                                ? "Substituir fotografia"
                                : "Adicionar fotografia"}
                          </button>
                          {draft.coverImageUrl ? (
                            <button
                              type="button"
                              className={CTA_SECONDARY}
                              onClick={() => setDraft(item.court.id, { coverImageUrl: "" })}
                            >
                              Remover fotografia
                            </button>
                          ) : null}
                          <details className="text-[11px] text-white/70">
                            <summary className="cursor-pointer select-none">URL avançada</summary>
                            <input
                              value={draft.coverImageUrl}
                              onChange={(event) => setDraft(item.court.id, { coverImageUrl: event.target.value })}
                              className="mt-2 w-full rounded-xl border border-white/12 bg-white/10 px-2 py-2 text-[12px] text-white outline-none"
                              placeholder="https://..."
                            />
                          </details>
                        </div>
                      </div>
                    </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-[12px] text-white/80">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) => setDraft(item.court.id, { isActive: event.target.checked })}
                        />
                        Campo visível para reservas
                      </label>
                      {availabilityHref ? (
                        <Link href={availabilityHref} className={CTA_SECONDARY}>
                          Gerir disponibilidade do campo
                        </Link>
                      ) : (
                        <span className="rounded-full border border-rose-300/35 bg-rose-400/10 px-3 py-1 text-[11px] text-rose-100">
                          Sem recurso associado
                        </span>
                      )}
                    </div>
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
      <EventCoverCropModal
        open={Boolean(cropContext)}
        file={cropContext?.file ?? null}
        onCancel={() => setCropContext(null)}
        onConfirm={async (file) => {
          if (!cropContext) return;
          const courtId = cropContext.courtId;
          setCropContext(null);
          await uploadCoverFile(courtId, file);
        }}
      />
    </>
  );
}
