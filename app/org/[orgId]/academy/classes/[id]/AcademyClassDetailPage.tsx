"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import { getEventCoverUrl } from "@/lib/eventCover";
import { AddressCombobox } from "@/components/ui/address-combobox";
import { OryaDateField, OryaTimeField } from "@/components/ui/datetime";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DURATION_OPTIONS = [30, 60, 90, 120];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Service = {
  id: number;
  policyId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode?: "FIXED" | "CHOOSE_AT_BOOKING" | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  policy?: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
  } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
};


type PolicyItem = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number | null;
};

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  courtId?: number | null;
  clubName?: string | null;
};

type CourtItem = {
  id: number;
  name: string | null;
  isActive: boolean;
  padelClubId?: number;
};

type ClassSeriesItem = {
  id: number;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  _count?: { sessions: number };
};

type ClassSessionItem = {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  series?: { id: number };
};

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function resolveResourceLinkId(resource: ResourceItem): number | null {
  if (typeof resource.resourceId === "number" && Number.isFinite(resource.resourceId) && resource.resourceId > 0) {
    return resource.resourceId;
  }
  if ((resource.sourceType ?? "RESOURCE") === "RESOURCE") {
    return resource.id;
  }
  return null;
}


export default function AcademyClassDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const serviceKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`)
    : null;
  const classSeriesKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series`)
    : null;
  const classSessionsKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/sessions`)
    : null;
  const clubsKey = "/api/padel/clubs?includeInactive=1";

  const { data: serviceData, mutate: mutateService } = useSWR<{ ok: boolean; service: Service }>(
    serviceKey,
    fetcher,
  );
  const { data: policiesData } = useSWR<{ ok: boolean; items: PolicyItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"),
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"),
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/resources?includeCourts=1"),
    fetcher,
  );
  const { data: classSeriesData, mutate: mutateClassSeries } = useSWR<{ ok: boolean; items: ClassSeriesItem[] }>(
    classSeriesKey,
    fetcher,
  );
  const { data: classSessionsData, mutate: mutateClassSessions } = useSWR<{ ok: boolean; items: ClassSessionItem[] }>(
    classSessionsKey,
    fetcher,
  );
  const { data: clubsData } = useSWR<{ ok: boolean; items: { id: number; name: string; isActive: boolean }[] }>(
    clubsKey,
    fetcher,
  );

  const service = serviceData?.service ?? null;
  const classSeries = classSeriesData?.items ?? [];
  const classSessions = classSessionsData?.items ?? [];
  const clubs = clubsData?.items ?? [];
  const policies = policiesData?.items ?? [];
  const professionals = professionalsData?.items ?? [];
  const resources = resourcesData?.items ?? [];
  const activeProfessionals = professionals.filter((professional) => professional.isActive);
  const resourceOptions = useMemo(
    () =>
      resources.map((resource) => {
        const linkId = resolveResourceLinkId(resource);
        const isCourt = (resource.sourceType ?? "RESOURCE") === "COURT";
        const scopeLabel = resource.clubName ? `${resource.label} · ${resource.clubName}` : resource.label;
        return {
          ...resource,
          linkId,
          scopeLabel,
          isCourt,
        };
      }),
    [resources],
  );
  const activeResourceOptions = resourceOptions.filter(
    (resource): resource is (typeof resourceOptions)[number] & { linkId: number } =>
      resource.isActive && resource.linkId != null,
  );
  const hasUnlinkedCourtOptions = resourceOptions.some((resource) => resource.isCourt && resource.linkId == null);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const courtsKey = selectedClubId ? `/api/padel/clubs/${selectedClubId}/courts` : null;
  const { data: courtsData } = useSWR<{ ok: boolean; items: CourtItem[] }>(courtsKey, fetcher);
  const courts = courtsData?.items ?? [];
  const entityLabel = "aula";
  const entityLabelTitle = "Aula";
  const teamHeading = "Treinadores e campos";
  const professionalLabelPlural = "Treinadores";
  const professionalLabelSingular = "Treinador";
  const resourceLabelPlural = "Campos";

  useEffect(() => {
    if (selectedClubId || clubs.length === 0) return;
    const preferred = clubs.find((club) => club.isActive) ?? clubs[0];
    if (preferred) setSelectedClubId(preferred.id);
  }, [clubs, selectedClubId]);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("60");
  const [formUnitPrice, setFormUnitPrice] = useState("0");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formCategoryTag, setFormCategoryTag] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formLocationMode, setFormLocationMode] = useState<LocationMode>("FIXED");
  const [formAddressQuery, setFormAddressQuery] = useState("");
  const [formAddressId, setFormAddressId] = useState<string | null>(null);
  const [formAddressLabel, setFormAddressLabel] = useState<string | null>(null);
  const [formPolicyId, setFormPolicyId] = useState("");
  const [linkedProfessionalIds, setLinkedProfessionalIds] = useState<number[]>([]);
  const [linkedResourceIds, setLinkedResourceIds] = useState<number[]>([]);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceErrorCtaHref, setServiceErrorCtaHref] = useState<string | null>(null);
  const [serviceErrorCtaLabel, setServiceErrorCtaLabel] = useState<string | null>(null);


  const [seriesEditingId, setSeriesEditingId] = useState<number | null>(null);
  const [seriesDay, setSeriesDay] = useState("1");
  const [seriesStartTime, setSeriesStartTime] = useState("18:00");
  const [seriesDuration, setSeriesDuration] = useState("60");
  const [seriesCapacity, setSeriesCapacity] = useState("4");
  const [seriesValidFrom, setSeriesValidFrom] = useState("");
  const [seriesValidUntil, setSeriesValidUntil] = useState("");
  const [seriesProfessionalId, setSeriesProfessionalId] = useState("");
  const [seriesCourtId, setSeriesCourtId] = useState("");
  const [seriesActive, setSeriesActive] = useState(true);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    setFormTitle(service.title ?? "");
    setFormDescription(service.description ?? "");
    setFormDuration(String(service.durationMinutes ?? 60));
    setFormUnitPrice(((service.unitPriceCents ?? 0) / 100).toFixed(2));
    setFormCurrency(service.currency ?? "EUR");
    setFormCategoryTag(service.categoryTag ?? "");
    setCoverUrl(service.coverImageUrl ?? null);
    setFormLocationMode(service.locationMode ?? "FIXED");
    setFormAddressId(service.addressId ?? null);
    setFormAddressLabel(service.addressRef?.formattedAddress ?? null);
    setFormAddressQuery(service.addressRef?.formattedAddress ?? "");
    setFormPolicyId(service.policyId ? String(service.policyId) : "");
    setLinkedProfessionalIds(service.professionalLinks?.map((link) => link.professionalId) ?? []);
    setLinkedResourceIds(service.resourceLinks?.map((link) => link.resourceId) ?? []);
  }, [service]);

  useEffect(() => {
    if (seriesValidFrom) return;
    setSeriesValidFrom(new Date().toISOString().slice(0, 10));
  }, [seriesValidFrom]);


  const toggleService = async () => {
    if (!serviceId || !service) return;
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const parsedError = parseApiError(json, `Não foi possível atualizar ${entityLabel}.`);
      const uiError = mapPaymentGateUiState({
        organizationId,
        errorCode: parsedError.errorCode,
        message: parsedError.message,
        details: parsedError.details,
      });
      setServiceError(uiError.message);
      setServiceErrorCtaHref(uiError.ctaHref);
      setServiceErrorCtaLabel(uiError.ctaLabel);
      return;
    }
    mutateService();
  };

  const toggleProfessionalLink = (id: number) => {
    setLinkedProfessionalIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleResourceLink = (id: number | null) => {
    if (!id) return;
    setLinkedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const coverPreviewUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getEventCoverUrl(coverUrl, {
      seed: `service-${serviceId ?? "cover"}`,
      width: 600,
      quality: 72,
      square: true,
    });
  }, [coverUrl, serviceId]);

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) {
        throw new Error("Organização inválida.");
      }
      const res = await fetch(`/api/upload?scope=service-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setServiceError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverCropCancel = () => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  };

  const handleCoverCropConfirm = async (file: File) => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await uploadCoverFile(file);
  };

  const handleServiceSave = async () => {
    if (!serviceId) return;
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    if (formLocationMode === "FIXED" && !formAddressId) {
      setServiceError("Seleciona uma morada Apple Maps.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
      return;
    }
    setServiceSaving(true);

    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          durationMinutes: Number(formDuration),
          unitPriceCents: Math.round(Number(formUnitPrice) * 100),
          currency: formCurrency,
          categoryTag: formCategoryTag.trim() || null,
          coverImageUrl: coverUrl,
          locationMode: formLocationMode,
          addressId: formLocationMode === "FIXED" ? formAddressId : null,
          policyId: formPolicyId ? Number(formPolicyId) : null,
          professionalIds: linkedProfessionalIds,
          resourceIds: linkedResourceIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, `Erro ao guardar ${entityLabel}.`);
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setServiceError(uiError.message);
        setServiceErrorCtaHref(uiError.ctaHref);
        setServiceErrorCtaLabel(uiError.ctaLabel);
        return;
      }
      mutateService();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : `Erro ao guardar ${entityLabel}.`);
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
    } finally {
      setServiceSaving(false);
    }
  };


  const resetSeriesForm = () => {
    setSeriesEditingId(null);
    setSeriesDay("1");
    setSeriesStartTime("18:00");
    setSeriesDuration("60");
    setSeriesCapacity("4");
    setSeriesValidFrom(new Date().toISOString().slice(0, 10));
    setSeriesValidUntil("");
    setSeriesProfessionalId("");
    setSeriesCourtId("");
    setSeriesActive(true);
    setSeriesError(null);
  };

  const handleSeriesEdit = (series: ClassSeriesItem) => {
    const hour = Math.floor(series.startMinute / 60);
    const minute = series.startMinute % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    setSeriesEditingId(series.id);
    setSeriesDay(String(series.dayOfWeek));
    setSeriesStartTime(`${pad(hour)}:${pad(minute)}`);
    setSeriesDuration(String(series.durationMinutes));
    setSeriesCapacity(String(series.capacity));
    setSeriesValidFrom(series.validFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setSeriesValidUntil(series.validUntil ? series.validUntil.slice(0, 10) : "");
    setSeriesProfessionalId(series.professional?.id ? String(series.professional.id) : "");
    setSeriesCourtId(series.court?.id ? String(series.court.id) : "");
    setSeriesActive(series.isActive);
    setSeriesError(null);
  };

  const handleSeriesSubmit = async () => {
    if (!serviceId) return;
    const [hourStr, minuteStr] = seriesStartTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      setSeriesError("Hora inválida.");
      return;
    }
    if (!seriesValidFrom) {
      setSeriesError("Seleciona a data inicial.");
      return;
    }
    const startMinute = hour * 60 + minute;
    const payload = {
      dayOfWeek: Number(seriesDay),
      startMinute,
      durationMinutes: Number(seriesDuration),
      capacity: Number(seriesCapacity),
      validFrom: seriesValidFrom,
      validUntil: seriesValidUntil || null,
      professionalId: seriesProfessionalId ? Number(seriesProfessionalId) : null,
      courtId: seriesCourtId ? Number(seriesCourtId) : null,
      isActive: seriesActive,
    };

    setSeriesSaving(true);
    setSeriesError(null);
    try {
      const url = seriesEditingId
        ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series/${seriesEditingId}`)
        : resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series`);
      const res = await fetch(url, {
        method: seriesEditingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao guardar série.");
      }
      mutateClassSeries();
      mutateClassSessions();
      resetSeriesForm();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao guardar série.");
    } finally {
      setSeriesSaving(false);
    }
  };

  const handleSeriesToggle = async (series: ClassSeriesItem, next: boolean) => {
    if (!serviceId) return;
    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series/${series.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar série.");
      }
      mutateClassSeries();
      mutateClassSessions();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao atualizar série.");
    }
  };

  if (!serviceId) {
    return <div className="text-white/70">Registo inválido.</div>;
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>{entityLabelTitle}</p>
        <h1 className="text-2xl font-semibold text-white">{service?.title || entityLabelTitle}</h1>
        <p className={DASHBOARD_MUTED}>
          {service
            ? `${service.durationMinutes} min · Preço: ${formatMoney(service.unitPriceCents, service.currency)}`
            : "A carregar detalhes..."}
        </p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}> 
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Detalhes</h2>
            <p className={DASHBOARD_MUTED}>Define a {entityLabel} e o preço unitário.</p>
          </div>
          {service && (
            <button type="button" className={CTA_SECONDARY} onClick={toggleService}>
              {service.isActive ? "Desativar" : "Ativar"}
            </button>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Título</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Fotografia da aula</label>
          <div className="mt-2 flex flex-wrap gap-4">
            <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt={`Capa da ${entityLabel}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">
                  Sem capa
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                />
                <span>{coverUrl ? "Substituir capa" : "Adicionar capa"}</span>
              </label>
              {coverUrl && (
                <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                  Remover capa
                </button>
              )}
              <p className={DASHBOARD_MUTED}>Imagem quadrada recomendada.</p>
              {uploadingCover && <p className={DASHBOARD_MUTED}>A carregar imagem...</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/80">Preço</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formUnitPrice}
              onChange={(e) => setFormUnitPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Moeda</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/80">Categoria (tag)</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formCategoryTag}
            onChange={(e) => setFormCategoryTag(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Modo de localização</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formLocationMode}
              onChange={(e) => {
                const next = e.target.value as LocationMode;
                setFormLocationMode(next);
                if (next !== "FIXED") {
                  setFormAddressId(null);
                  setFormAddressLabel(null);
                  setFormAddressQuery("");
                }
              }}
            >
              <option value="FIXED">Local fixo</option>
              <option value="CHOOSE_AT_BOOKING">Escolher na marcação</option>
            </select>
          </div>
          {formLocationMode === "FIXED" && (
            <div>
              <AddressCombobox
                label="Morada (Apple Maps)"
                className="mt-1"
                value={formAddressQuery}
                onValueChange={(next) => {
                  setFormAddressQuery(next);
                  if (!next.trim()) {
                    setFormAddressLabel(null);
                  }
                }}
                addressId={formAddressId}
                onAddressIdChange={(next) => {
                  setFormAddressId(next);
                  if (!next) {
                    setFormAddressLabel(null);
                  }
                }}
                onDetailsResolved={(details: GeoDetailsItem | null) => {
                  if (!details?.addressId) {
                    setFormAddressLabel(null);
                    return;
                  }
                  setFormAddressLabel(details.formattedAddress?.trim() || details.address?.trim() || null);
                }}
                minChars={2}
                maxItems={10}
                enableRecents
                enableGeolocationCta
              />
              {formAddressId && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                  Morada confirmada: {formAddressLabel || formAddressQuery}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Política de cancelamento</label>
          <select
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formPolicyId}
            onChange={(event) => setFormPolicyId(event.target.value)}
          >
            <option value="">Usar política default</option>
            {policies.map((policy) => (
              <option key={policy.id} value={String(policy.id)}>
                {policy.name}
              </option>
            ))}
          </select>
        </div>

        {serviceError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>{serviceError}</p>
            {serviceErrorCtaHref && serviceErrorCtaLabel ? (
              <button
                type="button"
                onClick={() => router.push(serviceErrorCtaHref)}
                className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
              >
                {serviceErrorCtaLabel}
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleServiceSave} disabled={serviceSaving}>
            {serviceSaving ? "A guardar..." : "Guardar alterações"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => router.push(appendOrganizationIdToHref("/org/academy/classes", organizationId))}
          >
            Voltar
          </button>
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">{teamHeading}</h2>
          <p className={DASHBOARD_MUTED}>
            Define quem pode executar esta {entityLabel}. Se não selecionares ninguém, usa todos os ativos.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">{professionalLabelPlural}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds(activeProfessionals.map((item) => item.id))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeProfessionals.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem {professionalLabelPlural.toLowerCase()} ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeProfessionals.map((professional) => (
                  <label
                    key={professional.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>{professional.name}</span>
                    <input
                      type="checkbox"
                      checked={linkedProfessionalIds.includes(professional.id)}
                      onChange={() => toggleProfessionalLink(professional.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">{resourceLabelPlural}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds(activeResourceOptions.map((item) => item.linkId))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeResourceOptions.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem {resourceLabelPlural.toLowerCase()} ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeResourceOptions.map((resource) => (
                  <label
                    key={`${resource.sourceType ?? "RESOURCE"}-${resource.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>
                      {resource.scopeLabel} · {resource.capacity}
                    </span>
                    <input
                      type="checkbox"
                      checked={linkedResourceIds.includes(resource.linkId)}
                      onChange={() => toggleResourceLink(resource.linkId)}
                    />
                  </label>
                ))}
              </div>
            )}
            {hasUnlinkedCourtOptions ? (
              <p className="text-[11px] text-white/45">
                Alguns campos ainda não têm recurso associado em Reservas e não podem ser ligados aqui.
              </p>
            ) : null}
          </div>
        </div>
      </section>


      {service?.kind === "CLASS" && (
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Aulas recorrentes</h2>
              <p className={DASHBOARD_MUTED}>Cria séries e gere sessões automaticamente.</p>
            </div>
            {seriesEditingId && (
              <button type="button" className={CTA_SECONDARY} onClick={resetSeriesForm}>
                Cancelar edição
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] text-white/70">
              Dia da semana
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesDay}
                onChange={(e) => setSeriesDay(e.target.value)}
              >
                {DAY_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Hora
              <OryaTimeField
                value={seriesStartTime}
                onChange={setSeriesStartTime}
                stepMinutes={15}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Duração (min)
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesDuration}
                onChange={(e) => setSeriesDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Capacidade
              <input
                type="number"
                min="1"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesCapacity}
                onChange={(e) => setSeriesCapacity(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] text-white/70">
              Válido desde
              <OryaDateField
                value={seriesValidFrom}
                onChange={setSeriesValidFrom}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Válido até
              <OryaDateField
                value={seriesValidUntil}
                onChange={setSeriesValidUntil}
                minDate={seriesValidFrom || undefined}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="text-[12px] text-white/70">
              {professionalLabelSingular}
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesProfessionalId}
                onChange={(e) => setSeriesProfessionalId(e.target.value)}
              >
                <option value="">{`Sem ${professionalLabelSingular.toLowerCase()}`}</option>
                {activeProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Campo (opcional)
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={seriesCourtId}
                onChange={(e) => setSeriesCourtId(e.target.value)}
                disabled={courts.length === 0}
              >
                <option value="">Sem campo</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name || `Campo ${court.id}`}{court.isActive ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {clubs.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-white/70">
                Clube
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={selectedClubId ?? ""}
                  onChange={(e) => setSelectedClubId(Number(e.target.value))}
                >
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}{club.isActive ? "" : " (inativo)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={seriesActive}
              onChange={(e) => setSeriesActive(e.target.checked)}
            />
            Série ativa
          </label>

          {seriesError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {seriesError}
            </div>
          )}

          <button type="button" className={CTA_PRIMARY} onClick={handleSeriesSubmit} disabled={seriesSaving}>
            {seriesSaving ? "A guardar..." : seriesEditingId ? "Guardar série" : "Criar série"}
          </button>

          <div className="space-y-3">
            {classSeries.length === 0 && (
              <p className="text-[12px] text-white/60">Sem séries criadas.</p>
            )}
            {classSeries.map((series) => {
              const hour = Math.floor(series.startMinute / 60);
              const minute = series.startMinute % 60;
              const pad = (value: number) => String(value).padStart(2, "0");
              return (
                <div key={series.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {DAY_LABELS[series.dayOfWeek]} · {pad(hour)}:{pad(minute)} · {series.durationMinutes} min
                      </p>
                      <p className="text-[12px] text-white/60">
                        Capacidade {series.capacity}
                        {series.professional?.name ? ` · ${series.professional.name}` : ""}
                        {series.court?.name ? ` · ${series.court.name}${series.court.isActive === false ? " (inativo)" : ""}` : ""}
                      </p>
                      <p className="text-[11px] text-white/45">
                        Válido: {series.validFrom.slice(0, 10)}
                        {series.validUntil ? ` → ${series.validUntil.slice(0, 10)}` : ""}
                      </p>
                      <p className="text-[11px] text-white/45">
                        Sessões: {series._count?.sessions ?? 0}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span>{series.isActive ? "Ativa" : "Inativa"}</span>
                      <button
                        type="button"
                        className={CTA_SECONDARY}
                        onClick={() => handleSeriesEdit(series)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={CTA_DANGER}
                        onClick={() => handleSeriesToggle(series, !series.isActive)}
                      >
                        {series.isActive ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] text-white/60">Próximas sessões</p>
            {classSessions.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem sessões futuras.</p>
            ) : (
              <div className="space-y-2">
                {classSessions.slice(0, 10).map((session) => (
                  <div key={session.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                    {new Date(session.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                    {session.professional?.name ? ` · ${session.professional.name}` : ""}
                    {session.court?.name ? ` · ${session.court.name}${session.court.isActive === false ? " (inativo)" : ""}` : ""}
                    {session.status ? ` · ${session.status}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

    </div>
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />
    </>
  );
}
